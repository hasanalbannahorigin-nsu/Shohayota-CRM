# ✅ Website is Running - Customer Login Ready!

## 🌐 Website URL
**http://localhost:5000**

## 🔑 Customer Login Credentials

### How to Get Customer Email:

The server automatically creates a customer user account during initialization. **Check your server console** for this message:

```
✅ Created customer user account: [email] (password: demo123)
```

The customer email will be the **first customer** from **Dhaka Tech Solutions** tenant.

### Email Format:
- Pattern: `[firstname].[lastname]1@company.com`
- Examples:
  - `rahim.khan1@company.com`
  - `karim.ahmed1@company.com`
  - `fatema.begum1@company.com`

### Password:
```
demo123
```

## 📋 Login Steps:

1. **Open browser**: Go to http://localhost:5000/login
2. **Find email**: Check server console for "Created customer user account" message
3. **Enter credentials**:
   - Email: (from console output)
   - Password: `demo123`
4. **You'll be redirected** to `/customer/dashboard`

## 🎨 What You Can Do After Login:

- ✅ View your tickets
- ✅ Create new tickets
- ✅ Send messages in tickets
- ✅ Request calls with support agents

---

**Note**: If you need to see all customer credentials, run:
```bash
npx tsx show-customer-credentials.ts
```

