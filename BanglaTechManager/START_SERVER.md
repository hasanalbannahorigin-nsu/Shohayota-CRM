# 🚀 How to Start the Server

## Quick Start

```bash
cd BanglaTechManager
npm run dev
```

## What to Expect

You should see output like:
```
⚙️  Initializing storage...
✓ Role templates initialized
✅ Created customer user account...
serving on port 5000
```

## Wait For

**Important:** Wait until you see:
```
serving on port 5000
```

This means the server is ready to accept connections.

## Verify Server is Running

### Method 1: Check Browser
Open: http://localhost:5000

Should show the login page or dashboard.

### Method 2: Check Port
```bash
Test-NetConnection -ComputerName localhost -Port 5000
```

Should show: `TcpTestSucceeded : True`

### Method 3: Check Health Endpoint
Open: http://localhost:5000/api/health

Should return JSON response.

## Troubleshooting

### Server Won't Start

1. **Check for errors** in the terminal
2. **Check Node version**: `node --version` (should be 18+)
3. **Check dependencies**: `npm install`
4. **Check port**: Make sure port 5000 is not in use

### Port Already in Use

If you see `EADDRINUSE`:
```bash
# Find process using port 5000
netstat -ano | findstr :5000

# Kill the process (replace PID)
taskkill /PID <PID> /F

# Start server again
npm run dev
```

### Server Crashes

1. Check terminal for error messages
2. Common issues:
   - Missing dependencies: Run `npm install`
   - Port conflict: Kill other process on port 5000
   - Syntax errors: Check server code

## After Server Starts

1. ✅ Server running on port 5000
2. ✅ Go to: http://localhost:5000/login
3. ✅ Login with customer credentials:
   - Email: `rahim.khan1@company.com`
   - Password: `demo123`

## Customer Login Credentials

**Password:** `demo123` (for all customers)

**Sample Emails:**
- `rahim.khan1@company.com`
- `fatema.khan2@company.com`
- `karim.ahmed3@company.com`
- `jasmine.iyer1@company.com`
