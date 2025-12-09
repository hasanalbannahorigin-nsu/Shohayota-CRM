# 🚀 Quick Start: Test All Role-Based Logins

## ✅ Server Status

The server should be running in the background. If not, start it with:

```bash
cd BanglaTechManager
npm run dev
```

## 🎯 Three Ways to Test All Roles

### Method 1: Interactive HTML Page (Easiest)

1. **Open the test page:**
   - Navigate to: `BanglaTechManager\test-all-roles.html`
   - Double-click the file to open in your browser
   - Or open: `file:///C:/Users/HP/Downloads/Shohayota/BanglaTechManager/test-all-roles.html`

2. **Click any "Login" button** to automatically test that role

### Method 2: Automated Script

Run the test script:

```bash
cd BanglaTechManager
npx tsx test-all-role-logins.ts
```

This will test all logins programmatically and show results.

### Method 3: Manual Testing

1. **Open:** http://localhost:5000/login
2. **Use credentials from the table below**

---

## 📋 All Login Credentials

### 👑 Super Admin
- **Email:** `superadmin@sohayota.com`
- **Password:** `demo123`

### 🏢 Tenant Admins
- **Dhaka:** `admin@dhakatech.com` / `demo123`
- **Chittagong:** `admin@chittagong.tech.com` / `demo123`
- **Sylhet:** `admin@sylhet.software.com` / `demo123`
- **Khulna:** `admin@khulna.it.com` / `demo123`

### 👨‍💼 Support Agents
- **Dhaka:** `support@dhaka.com` / `demo123`
- **Chittagong:** `support@chittagong.com` / `demo123`
- **Sylhet:** `support@sylhet.com` / `demo123`
- **Khulna:** `support@khulna.com` / `demo123`

### 👤 Customers
- **Sample 1:** `rahim.khan1@company.com` / `demo123`
- **Sample 2:** `fatema.khan2@company.com` / `demo123`
- **Sample 3:** `priya.sharma19@company.com` / `demo123`
- **Sample 4:** `majid.hassan85@company.com` / `demo123`

**Note:** There are ~150 customer accounts. To see all, run:
```bash
npx tsx show-customer-credentials.ts
```

---

## 🎯 What to Test

1. **Super Admin:** Can view all tenants
2. **Tenant Admin:** Can only see own tenant's data
3. **Support Agent:** Can manage tickets but not delete customers
4. **Customer:** Redirected to `/customer/dashboard`, can create tickets

---

## 📖 Full Documentation

See `ROLE_BASED_LOGIN_GUIDE.md` for complete testing scenarios and troubleshooting.

