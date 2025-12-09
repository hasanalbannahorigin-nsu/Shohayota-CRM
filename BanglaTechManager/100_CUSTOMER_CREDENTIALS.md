# 100 Customer Login Credentials

## How to Generate

### Option 1: Using API Endpoint (Recommended)

1. Start the server:
   ```bash
   npm run dev
   ```

2. Call the API endpoint:
   ```bash
   curl http://localhost:5000/api/debug/generate-100-customers
   ```

   Or open in browser:
   ```
   http://localhost:5000/api/debug/generate-100-customers
   ```

3. The response will include all 100 customer credentials grouped by tenant.

### Option 2: Using Script

Run the TypeScript script:
```bash
npx tsx scripts/generate-100-customers.ts
```

This will:
- Create 100 customers (25 per tenant)
- Create user accounts for each customer
- Display credentials in console
- Save credentials to `100-customer-credentials.txt`

## Credentials Format

All customers use the same password: **`customer123`**

### Distribution:
- **Dhaka Tech Solutions**: 25 customers
- **Chittagong Tech Hub**: 25 customers  
- **Sylhet Software House**: 25 customers
- **Khulna IT Systems**: 25 customers

## Example Credentials

The generated emails follow this pattern:
- `firstname.lastname1@domain.com`
- `firstname.lastname2@domain.com`
- etc.

Example:
- Email: `rahim.khan1@gmail.com`
- Password: `customer123`

## Notes

- All passwords are: **customer123**
- Customers are distributed evenly across 4 tenants
- Each customer has a unique email address
- Customer accounts are created with `customer` role
- All customers are set to `active` status

## After Generation

Once generated, you can:
1. Login as any customer using their email and password `customer123`
2. Access the customer portal at `/customer/dashboard`
3. Create tickets, view tickets, etc.

## API Response Format

```json
{
  "success": true,
  "message": "Generated 100 customer accounts",
  "total": 100,
  "credentials": [
    {
      "email": "rahim.khan1@gmail.com",
      "password": "customer123",
      "name": "Rahim Khan",
      "tenant": "Dhaka Tech Solutions"
    },
    ...
  ],
  "groupedByTenant": {
    "Dhaka Tech Solutions": [...],
    "Chittagong Tech Hub": [...],
    ...
  }
}
```

