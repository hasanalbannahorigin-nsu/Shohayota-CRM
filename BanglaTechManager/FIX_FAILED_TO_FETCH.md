# 🔧 Fix "Failed to Fetch" Error

## Problem
You're seeing "Failed to fetch" error when trying to login.

## Solution: Start the Server

The "Failed to fetch" error means the server is not running. Start it:

### Step 1: Start the Server

```bash
cd BanglaTechManager
npm run dev
```

### Step 2: Wait for Server to Start

Wait until you see:
```
serving on port 5000
```

This means the server is ready.

### Step 3: Try Login Again

1. Go to: http://localhost:5000/login
2. Enter customer credentials:
   - Email: `rahim.khan1@company.com`
   - Password: `demo123`
3. Click "Sign In"

## Verify Server is Running

### Check Port 5000
```bash
Test-NetConnection -ComputerName localhost -Port 5000
```

Should show: `TcpTestSucceeded : True`

### Check Node Process
```bash
Get-Process -Name node
```

Should show running Node.js processes.

## Common Issues

### Issue 1: Server Not Started
**Solution:** Run `npm run dev` in the `BanglaTechManager` directory

### Issue 2: Port Already in Use
**Error:** `EADDRINUSE: address already in use :::5000`

**Solution:**
1. Find the process using port 5000:
   ```bash
   netstat -ano | findstr :5000
   ```
2. Kill the process (replace PID with the number from above):
   ```bash
   taskkill /PID <PID> /F
   ```
3. Start server again: `npm run dev`

### Issue 3: Server Crashed
**Solution:**
1. Check the terminal for error messages
2. Fix any errors shown
3. Restart: `npm run dev`

### Issue 4: Wrong Directory
**Solution:** Make sure you're in the `BanglaTechManager` directory:
```bash
cd BanglaTechManager
npm run dev
```

## Quick Test

Test if server is responding:

```bash
curl http://localhost:5000/api/health
```

Or open in browser: http://localhost:5000/api/health

Should return a JSON response.

## Server Startup Checklist

✅ Server command: `npm run dev`  
✅ Wait for: `serving on port 5000`  
✅ Check: http://localhost:5000 loads  
✅ Try login: http://localhost:5000/login  

## Still Not Working?

1. **Check terminal** - Look for error messages
2. **Check port** - Make sure nothing else is using port 5000
3. **Restart** - Stop server (Ctrl+C) and start again
4. **Check Node version** - Should be Node.js 18+ (run `node --version`)

