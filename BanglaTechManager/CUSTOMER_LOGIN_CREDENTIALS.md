# 📧 Customer Login Credentials

## 🎯 All Customer Accounts

**Password for ALL customers**: `demo123`

---

## 📋 Customer Emails (Sample)

Based on the system initialization, here are customer emails you can use:

### Tenant 1: Dhaka Tech Solutions (38 customers)

1. `rahim.khan1@company.com` / `demo123`
2. `karim.ahmed2@company.com` / `demo123`
3. `hassan.ali3@company.com` / `demo123`
4. `ahmed.hossain4@company.com` / `demo123`
5. `ali.islam5@company.com` / `demo123`
6. `mohammad.rahman6@company.com` / `demo123`
7. `ibrahim.begum7@company.com` / `demo123`
8. `abdullah.shah8@company.com` / `demo123`
9. `sufia.begum9@company.com` / `demo123`
10. `nadia.khan10@company.com` / `demo123`
... (and 28 more)

### Tenant 2: Chittagong Tech Hub (38 customers)

39. `rahim.singh39@company.com` / `demo123`
40. `karim.kumar40@company.com` / `demo123`
41. `hassan.patel41@company.com` / `demo123`
... (and 35 more)

### Tenant 3: Sylhet Software House (38 customers)

77. `rahim.ahmed77@company.com` / `demo123`
78. `fatema.khan78@company.com` / `demo123`
... (and 36 more)

### Tenant 4: Khulna IT Systems (36 customers)

115. `samir.patel123@company.com` / `demo123`
116. `karim.ahmed133@company.com` / `demo123`
... (and 34 more)

---

## 🚀 Quick Test Login

**Try any of these:**

| Email | Password | Tenant |
|-------|----------|--------|
| `rahim.khan1@company.com` | `demo123` | Dhaka Tech Solutions |
| `fatema.khan2@company.com` | `demo123` | Dhaka Tech Solutions |
| `karim.ahmed3@company.com` | `demo123` | Dhaka Tech Solutions |
| `sufia.begum9@company.com` | `demo123` | Dhaka Tech Solutions |
| `priya.sharma19@company.com` | `demo123` | Chittagong Tech Hub |
| `deepak.singh57@company.com` | `demo123` | Chittagong Tech Hub |
| `majid.hassan85@company.com` | `demo123` | Sylhet Software House |
| `ravi.iyer95@company.com` | `demo123` | Sylhet Software House |
| `samir.patel123@company.com` | `demo123` | Khulna IT Systems |
| `priya.ahmed143@company.com` | `demo123` | Khulna IT Systems |

---

## 📋 How to Get All Customer Emails

### Method 1: From Customer Portal (Admin Login Required)

1. **Login as admin**: `admin@dhakatech.com` / `demo123`
2. **Go to Customers page**
3. **Copy any customer email** from the list
4. **Use for customer login**: Email + Password: `demo123`

### Method 2: Using API (Browser Console)

```javascript
// Get all customer emails
fetch('/api/customers')
  .then(r => r.json())
  .then(customers => {
    console.log('Customer Emails:');
    customers.forEach((c, i) => {
      console.log(`${i + 1}. ${c.email} / demo123`);
    });
  });
```

### Method 3: Check Server Console

When server starts, it shows customer emails being created:
```
✅ Created customer user account 1/38: rahim.khan1@company.com
✅ Created customer user account 10/38: sufia.begum9@company.com
...
```

---

## ✅ Login Steps

1. **Go to**: http://localhost:5000/login
2. **Email**: Any customer email from above (e.g., `rahim.khan1@company.com`)
3. **Password**: `demo123`
4. **Click**: "Sign In"
5. **You'll be redirected** to: `/customer/dashboard`

---

## 🎯 Pattern

All customer emails follow this pattern:
- Format: `firstname.lastname[number]@company.com`
- Examples: `rahim.khan1@company.com`, `fatema.begum2@company.com`
- Password: `demo123` (same for all)

---

## ⚠️ Important Notes

- **Password is same for all customers**: `demo123`
- **Email is case-insensitive** - `Rahim.Khan1@Company.com` works too
- **Auto-creation**: If account doesn't exist, it's created automatically on login
- **Total customers**: 150 across 4 tenants

---

**Use any customer email from the portal with password `demo123` to login!** 🚀
