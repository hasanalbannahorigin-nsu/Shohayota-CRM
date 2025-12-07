# Multi-Tenant System Test Suite

This directory contains comprehensive tests for the multi-tenant system.

## Test Files

### `isolation.test.ts`
Tests data isolation between tenants:
- Authentication and tenant context
- Customer data isolation
- Ticket data isolation
- User data isolation
- Database-level protection
- Tenant ID injection prevention

### `provisioning.test.ts`
Tests tenant provisioning:
- New tenant creation
- Default settings and quotas
- Admin user creation
- Idempotency

### `quotas.test.ts`
Tests quota enforcement:
- API call tracking
- User quota limits
- Customer quota limits
- Quota warnings

### `export-delete.test.ts`
Tests export and deletion:
- Complete data export
- GDPR compliance
- Soft delete
- Hard delete

## Running Tests

### Prerequisites
```bash
npm install --save-dev jest @types/jest ts-jest
```

### Run All Tests
```bash
npm test
```

### Run Specific Test File
```bash
npm test -- isolation.test.ts
```

### Run with Coverage
```bash
npm test -- --coverage
```

## Test Configuration

Create `jest.config.js`:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'server/**/*.ts',
    '!server/**/*.d.ts',
  ],
};
```

## Manual Testing

For manual testing, use the provided PowerShell script:
```powershell
.\test-isolation-fix.ps1
```

## Test Data

Tests use the following test accounts:
- Super Admin: `superadmin@sohayota.com` / `demo123`
- Tenant A: `admin@dhakatech.com` / `demo123`
- Tenant B: `admin@chittagong.tech.com` / `demo123`

## Notes

- Tests require the server to be running on `http://localhost:5000`
- Tests may create and delete test data
- Some tests require cleanup after execution
- Hard delete tests may need retention period adjustments

