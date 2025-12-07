import { Request, Response, NextFunction } from "express";

// Simple in-memory rate limiter for login
const loginAttempts = new Map<string, { count: number; timestamp: number }>();

export function loginLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5;

  const attempt = loginAttempts.get(ip);
  
  if (attempt && now - attempt.timestamp < windowMs) {
    if (attempt.count >= maxAttempts) {
      res.status(429).json({ error: "Too many login attempts. Try again later." });
      return;
    }
    attempt.count++;
  } else {
    loginAttempts.set(ip, { count: 1, timestamp: now });
  }

  next();
}

// Security headers middleware
export function securityHeaders(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  
  // Enable XSS protection
  res.setHeader("X-XSS-Protection", "1; mode=block");
  
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");
  
  // Control referrer information
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Permissions policy
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()"
  );
  
  next();
}

// CORS configuration
export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = [
      "http://localhost:5000",
      "http://localhost:3000",
      process.env.FRONTEND_URL,
    ].filter(Boolean);

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
