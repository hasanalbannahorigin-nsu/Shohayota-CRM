# Connector Framework Backend Implementation

## Overview
This document describes the backend implementation for Feature 7 - Third-Party Integrations & Connector Framework.

## Files Created

### 1. Integration Service
**Location:** `server/src/services/integration.service.ts` (or `server/services/integration.service.ts`)

Manages tenant-scoped connector integrations:
- `createIntegration()` - Create new integration with encrypted credentials
- `getIntegrationById()` - Get integration by ID
- `getIntegrationWithCredentials()` - Get integration with decrypted credentials
- `updateIntegrationCredentials()` - Update encrypted credentials
- `getTenantIntegrations()` - List all integrations for a tenant
- `deleteIntegration()` - Soft delete integration
- `updateIntegrationStatus()` - Update integration status

### 2. OAuth Controller
**Location:** `server/src/routes/oauth.controller.ts` (or `server/routes/oauth.controller.ts`)

Handles OAuth flows:
- `GET /api/oauth/start/:connectorId` - Initiate OAuth flow
- `GET /api/oauth/callback/:connectorId` - Handle OAuth callback

Features:
- Secure state token generation (CSRF protection)
- Server-side state storage
- Automatic token exchange
- Integration creation with encrypted credentials

### 3. Webhook Ingestion
**Location:** `server/src/routes/webhook.ingest.ts` (or `server/routes/webhook.ingest.ts`)

Unified webhook receiver:
- `POST /api/webhooks/:connectorId/:webhookSecret` - Receive provider webhooks

Features:
- Signature validation (provider-specific)
- Idempotency (deduplication by provider event ID)
- Event normalization via adapters
- Tenant routing via webhook secret

### 4. Queue Manager
**Location:** `server/src/worker/queueManager.ts`

Background job queue management:
- Webhook processing queue
- Connector sync queue
- Automation queue

Uses BullMQ with Redis for reliable job processing.

### 5. Migration
**Location:** `migrations/0007_webhook_events_dedupe.sql`

Creates `webhook_events` table for deduplication:
- Stores provider event IDs
- Prevents duplicate processing
- Indexed for fast lookups

### 6. Tests
**Location:** `server/tests/connectors.integration.test.ts`

Integration tests for:
- Webhook ingestion
- OAuth flows
- Integration management

## Setup Instructions

### 1. Install Dependencies
```bash
npm install bullmq ioredis
```

### 2. Run Migration
```bash
# Apply the webhook_events table migration
psql -d your_database -f migrations/0007_webhook_events_dedupe.sql
```

### 3. Environment Variables
Add to `.env`:
```env
# OAuth Credentials
OAUTH_GMAIL_CLIENT_ID=your-google-client-id
OAUTH_GMAIL_CLIENT_SECRET=your-google-client-secret
OAUTH_SLACK_CLIENT_ID=your-slack-client-id
OAUTH_SLACK_CLIENT_SECRET=your-slack-client-secret
# ... etc for other connectors

# App URLs
APP_BASE_URL=http://localhost:5000
FRONTEND_URL=http://localhost:5000

# Redis (for job queues)
REDIS_URL=redis://localhost:6379

# Encryption
ENCRYPTION_KEY=your-32-byte-key
KMS_KEY=your-32-byte-key
```

### 4. Register Routes
In `server/routes.ts`, add:
```typescript
import oauthRouter from "./routes/oauth.controller";
import webhookRouter from "./routes/webhook.ingest";

// Inside registerRoutes function:
app.use("/api/oauth", oauthRouter);
app.use("/api/webhooks", webhookRouter);
```

### 5. Start Redis
```bash
# Using Docker
docker run -d -p 6379:6379 redis:alpine

# Or install locally
redis-server
```

## Usage Examples

### Connect Gmail Integration
1. User clicks "Connect Gmail" in UI
2. Frontend calls: `GET /api/oauth/start/gmail`
3. User redirected to Google OAuth
4. Google redirects to: `GET /api/oauth/callback/gmail?code=...&state=...`
5. Backend exchanges code for tokens
6. Integration created with encrypted credentials
7. User redirected to success page

### Receive Webhook
1. Provider sends webhook to: `POST /api/webhooks/gmail/{webhookSecret}`
2. Backend validates signature
3. Checks for duplicate (by provider event ID)
4. Stores webhook event
5. Normalizes via adapter
6. Enqueues for processing
7. Returns 200 OK

### Process Webhook (Background Worker)
```typescript
import { createWebhookWorker } from "./worker/queueManager";

const worker = createWebhookWorker(async (job) => {
  const { tenantId, integrationId, event } = job.data;
  // Process normalized event
  // Create ticket, update customer, etc.
});

worker.on("completed", (job) => {
  console.log(`Webhook processed: ${job.id}`);
});
```

## Security Notes

1. **Never trust client-provided tenant ID** - Always derive from authenticated user
2. **Encrypt all credentials** - Use KMS-backed encryption in production
3. **Validate webhook signatures** - Provider-specific validation
4. **Use idempotency** - Prevent duplicate processing
5. **Store OAuth state server-side** - Use Redis in production, not in-memory Map

## Production Checklist

- [ ] Replace in-memory OAuth state store with Redis
- [ ] Use proper KMS (AWS KMS, Azure Key Vault) for encryption
- [ ] Implement rate limiting per tenant
- [ ] Add monitoring and alerting
- [ ] Set up DLQ (Dead Letter Queue) for failed jobs
- [ ] Add comprehensive logging
- [ ] Implement webhook retry logic
- [ ] Add health checks for connectors
- [ ] Set up automated token refresh

## Next Steps

1. Implement webhook processing workers
2. Add connector sync workers
3. Integrate with automation engine
4. Add connector health monitoring
5. Implement token refresh automation
6. Add connector metrics and dashboards

