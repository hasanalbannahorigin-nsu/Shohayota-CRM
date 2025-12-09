# Company Name from Tenant - Implementation Plan

## Goal
Ensure company name comes from tenant (tenants.name), not from customer.company field. Customers should display the tenant's official company name.

## Implementation Steps

### 1. Backend - Storage Layer
- Update storage methods to join tenant data and return `companyName` from tenant name
- Modify customer queries to include tenant name as `companyName`

### 2. Backend - Routes
- Strip `company` field from request body on create/update
- Ensure `company` field is never set from client input
- Return customers with `companyName` from tenant

### 3. Frontend
- Update Customer type to include optional `companyName` field
- Update UI to display `companyName` instead of `company` field
- Update export to use `companyName`

Let's implement this step by step.

