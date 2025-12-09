# 🔧 How to Stop the Server on Port 5000

## Quick Fix

The error `EADDRINUSE: address already in use 0.0.0.0:5000` means port 5000 is already being used.

## ✅ Solution 1: Find and Kill the Process (Windows)

**Option A: Using PowerShell**
```powershell
# Find the process using port 5000
Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process -Force

# Then start server again
npm run dev
```

**Option B: Using Command Prompt**
```cmd
# Find process ID
netstat -ano | findstr :5000

# Kill the process (replace PID with the number from above)
taskkill /PID <PID> /F

# Then start server again
npm run dev
```

**Option C: Simple PowerShell One-Liner**
```powershell
Stop-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess -Force
```

## ✅ Solution 2: Change Port

If you want to use a different port:

1. Create/Edit `.env` file in `BanglaTechManager` folder:
   ```
   PORT=5001
   ```

2. Start server:
   ```bash
   npm run dev
   ```

3. Access at: http://localhost:5001

## ✅ Solution 3: Restart Everything

1. **Close all terminal windows**
2. **Open new terminal**
3. **Navigate to project:**
   ```bash
   cd C:\Users\HP\Downloads\Shohayota\BanglaTechManager
   ```
4. **Start server:**
   ```bash
   npm run dev
   ```

---

## 🎉 Good News!

I can see from your output that:
- ✅ **150 customer accounts were created successfully!**
- ✅ All customers now have login access
- ✅ Customer login should work!

Once you fix the port issue and restart, customer login will work with:
- **Email**: Any customer email (e.g., `sufia.begum9@company.com`)
- **Password**: `demo123`

---

## Quick Command

Run this in PowerShell to kill the process on port 5000:

```powershell
Stop-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess -Force; cd C:\Users\HP\Downloads\Shohayota\BanglaTechManager; npm run dev
```

