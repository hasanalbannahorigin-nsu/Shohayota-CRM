# 📧 Actual Customer Emails in System

## ⚠️ Important Note

Customer emails are **randomly generated** each time the server starts. The emails like `rahim.khan1@company.com` may not exist because names are randomly selected.

## ✅ Solution: Use Known Test Accounts

I've created known customer accounts that you can always use:

### Known Test Accounts (Always Available)

| Email | Password | Tenant |
|-------|----------|--------|
| `rahim.khan1@company.com` | `demo123` | Dhaka Tech Solutions |
| `fatema.khan2@company.com` | `demo123` | Dhaka Tech Solutions |
| `karim.ahmed3@company.com` | `demo123` | Dhaka Tech Solutions |
| `sufia.begum9@company.com` | `demo123` | Dhaka Tech Solutions |
| `jasmine.iyer1@company.com` | `demo123` | Dhaka Tech Solutions |
| `priya.sharma19@company.com` | `demo123` | Chittagong Tech Hub |
| `deepak.singh57@company.com` | `demo123` | Chittagong Tech Hub |
| `majid.hassan85@company.com` | `demo123` | Sylhet Software House |
| `ravi.iyer95@company.com` | `demo123` | Sylhet Software House |
| `samir.patel123@company.com` | `demo123` | Khulna IT Systems |

## 🔍 How to See All Customer Emails

Run this command to see all customer emails in the system:

```bash
cd BanglaTechManager
npx tsx list-all-customer-emails.ts
```

This will show you:
- All customer emails grouped by tenant
- First 20 emails from each tenant
- Which accounts are ready for login

## 🎯 Quick Test

Use any of the known test accounts above:
1. Go to: http://localhost:5000/login
2. Email: `rahim.khan1@company.com`
3. Password: `demo123`
4. Click "Sign In"

## 🔧 If Known Accounts Don't Work

Run this to create/fix the known accounts:

```bash
cd BanglaTechManager
npx tsx create-known-customer-accounts.ts
```

This will ensure all known test accounts exist and are ready for login.

## 📋 Sample Random Emails (May Vary)

The system creates 150 customers with random names. Examples:
- `samira.singh1@company.com`
- `anita.shah2@company.com`
- `priya.menon3@company.com`
- `jasmine.shah30@company.com`
- `jasmine.khan125@company.com`

**Note:** These emails change each time you restart the server!

## 💡 Recommendation

**Always use the known test accounts** listed above. They are created specifically for testing and will always work.

