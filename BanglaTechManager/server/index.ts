import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { initializeStorage } from "./init-storage";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await initializeStorage();
  const server = await registerRoutes(app);
  
  // Initialize WebSocket server for live AI chat
  const { initWebSocketServer } = await import('./websocket-server');
  initWebSocketServer(server);
  
  // Ensure all customer accounts exist after routes are registered
  // This runs after a delay to allow storage to be fully initialized
  setTimeout(async () => {
    try {
      const memStorage = storage as any;
      const allCustomers = Array.from(memStorage.customers?.values() || []);
      
      if (allCustomers.length > 0) {
        console.log(`\n🔍 [STARTUP] Verifying ${allCustomers.length} customer accounts...`);
        let created = 0;
        let skipped = 0;
        
        for (const customer of allCustomers) {
          try {
            const existingUser = await storage.getUserByEmail(customer.email);
            
            if (existingUser && existingUser.role === "customer" && 
                (existingUser as any).customerId === customer.id && 
                existingUser.passwordHash) {
              skipped++;
              continue;
            }

            // Create or fix user account
            if (existingUser && (existingUser.role !== "customer" || 
                (existingUser as any).customerId !== customer.id || 
                !existingUser.passwordHash)) {
              memStorage.users.delete(existingUser.id);
            }

            await storage.createCustomerUser(
              customer.tenantId,
              customer.id,
              customer.email,
              "demo123",
              customer.name
            );
            created++;
          } catch (error) {
            // Continue
          }
        }
        
        if (created > 0) {
          console.log(`✅ [STARTUP] Created ${created} customer accounts (${skipped} already exist)`);
        } else {
          console.log(`✅ [STARTUP] All ${skipped} customer accounts verified`);
        }
        console.log(`📧 Customer login: Use any customer email with password: demo123\n`);
      }
    } catch (error) {
      console.error("[STARTUP] Error verifying customer accounts:", error);
    }
  }, 3000);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      // reusePort is not supported on all platforms (e.g. Windows),
      // so omit it to avoid ENOTSUP errors.
    },
    () => {
      log(`serving on port ${port}`);
    }
  );
})();
