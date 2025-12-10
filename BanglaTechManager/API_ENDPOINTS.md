# API Endpoints Reference

All API endpoints are defined in the following files:

## Main Route Files

### 1. Primary Routes File
**Location:** `server/routes.ts`
- Contains the main API endpoint definitions
- Handles authentication, customers, tickets, messages, analytics, etc.

### 2. Modular Route Files
**Location:** `server/routes/` directory

- `routes/users.ts` - User management endpoints
- `routes/teams.ts` - Team management endpoints  
- `routes/roles.ts` - Role and permission endpoints
- `routes/ai.ts` - AI assistant endpoints
- `routes/telephony.ts` - Phone call endpoints
- `routes/connectors.ts` - Integration connector endpoints
- `routes/customer-portal.ts` - Customer portal endpoints
- `routes/debug-customers.ts` - Debug endpoints for customers

### 3. OAuth & Webhooks
**Location:** `server/src/routes/`

- `oauth.controller.ts` - OAuth authentication routes
- `webhook.ingest.ts` - Webhook ingestion routes

## API Base URL

All endpoints are prefixed with `/api/`

**Base URL:** `http://localhost:5000/api/`

## Endpoint Categories

### Authentication (`/api/auth/`)
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current authenticated user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout

### Customers (`/api/customers`)
- `GET /api/customers` - List all customers
- `GET /api/customers/:id` - Get customer details
- `GET /api/customers/:id/timeline` - Get customer timeline
- `GET /api/customers/:id/tickets` - Get customer tickets
- `GET /api/customers/:id/calls` - Get customer phone calls
- `GET /api/customers/search?q=...` - Search customers
- `POST /api/customers` - Create customer
- `PATCH /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

### Tickets (`/api/tickets`)
- `GET /api/tickets` - List all tickets
- `GET /api/tickets/:id` - Get ticket details
- `POST /api/tickets` - Create ticket
- `PATCH /api/tickets/:id` - Update ticket
- `DELETE /api/tickets/:id` - Delete ticket

### Messages (`/api/messages`)
- `GET /api/tickets/:ticketId/messages` - Get ticket messages/comments
- `POST /api/messages` - Create message/comment

### Search & Analytics
- `GET /api/search?q=...` - Full-text search
- `GET /api/analytics/stats` - Dashboard statistics

### Tenants (`/api/tenants`)
- `GET /api/tenants/current` - Get current tenant
- `GET /api/tenants/users` - Get tenant users
- `POST /api/tenants/users` - Create tenant user
- `GET /api/tenants/stats` - Get tenant statistics

### Health Check
- `GET /api/health` - Health check endpoint

## Modular Route Endpoints

### Users (`routes/users.ts`)
- Check file for user management endpoints

### Teams (`routes/teams.ts`)
- Check file for team management endpoints

### Roles (`routes/roles.ts`)
- Check file for role and permission endpoints

### AI (`routes/ai.ts`)
- Check file for AI assistant endpoints

### Telephony (`routes/telephony.ts`)
- Check file for phone call endpoints

### Connectors (`routes/connectors.ts`)
- Check file for integration connector endpoints

### Customer Portal (`routes/customer-portal.ts`)
- Check file for customer-facing portal endpoints

### OAuth (`src/routes/oauth.controller.ts`)
- OAuth authentication endpoints

### Webhooks (`src/routes/webhook.ingest.ts`)
- Webhook ingestion endpoints

## Authentication

Most endpoints require authentication via JWT token:
```
Authorization: Bearer <your-jwt-token>
```

## Tenant Isolation

All endpoints automatically enforce tenant isolation based on the authenticated user's tenant ID.

