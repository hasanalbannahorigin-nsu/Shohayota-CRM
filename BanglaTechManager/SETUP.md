# Sohayota CRM - Setup & Deployment Guide

## Quick Start (Development)

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### 1. Clone Repository & Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file (or use `.env.example` as template):
```bash
cp .env.example .env
```

Edit `.env` with your database and secret credentials:
```env
DATABASE_URL="postgres://username:password@localhost:5432/sohayota_crm"
SESSION_SECRET="your-super-secure-random-32-char-string"
NODE_ENV="development"
PORT=5000
ADMIN_PASSWORD="your-secure-password"
```

**Important**: Generate a strong SESSION_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Set Up Database

#### Option A: Using Drizzle ORM (Recommended)
```bash
npm run db:push
```

#### Option B: Manual Database Creation
```bash
createdb sohayota_crm
psql sohayota_crm < schema.sql  # if you have a schema file
```

### 4. Seed Initial Data

The seed script creates initial tenants and admin users:

```bash
# Set environment variables
export DATABASE_URL="postgres://user:pass@localhost:5432/sohayota_crm"
export ADMIN_PASSWORD="your-secure-password"

# Run seed script
node seed.js
```

**Output Example:**
```
✅ Seed completed successfully!

📋 Test Credentials:
─────────────────────────────────────
Tenant 1: Dhaka Tech Solutions
  Email: admin@dhakatech.com
  Password: your-secure-password
  Role: tenant_admin

Tenant 2: Chittagong Software House
  Email: admin@chittagong.tech.com
  Password: your-secure-password
  Role: tenant_admin

... (more tenants)

Super Admin:
  Email: superadmin@sohayota.com
  Password: your-secure-password
  Role: super_admin
─────────────────────────────────────
```

### 5. Start Development Server

```bash
npm run dev
```

Server will be available at: `http://localhost:5000`

## Production Deployment

### 1. Build Application
```bash
npm run build
```

### 2. Production Environment

Set these in your hosting provider (Replit Secrets, Railway, Render, etc.):

```env
NODE_ENV="production"
DATABASE_URL="postgres://prod-user:secure-pass@prod-host:5432/prod-db"
SESSION_SECRET="your-production-secret-key-32-chars-min"
PORT=5000
```

### 3. Run Migrations in Production

```bash
npm run db:push
```

### 4. Run Seed Script (Optional - Create Initial Admin)

```bash
export DATABASE_URL="your-production-database-url"
export ADMIN_PASSWORD="your-initial-admin-password"
node seed.js
```

### 5. Start Production Server

```bash
npm run start
```

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✓ | - | PostgreSQL connection string |
| `SESSION_SECRET` | ✓ | - | JWT signing secret (32+ chars) |
| `NODE_ENV` | ✗ | development | Environment (development/production) |
| `PORT` | ✗ | 5000 | Server port |
| `ADMIN_PASSWORD` | ✗ | demo123 | Seed script admin password |
| `FRONTEND_URL` | ✗ | http://localhost:5000 | Frontend URL for CORS |
| `EMAIL_SERVICE` | ✗ | - | Email provider (sendgrid/nodemailer) |
| `SENDGRID_API_KEY` | ✗ | - | SendGrid API key |
| `EMAIL_FROM` | ✗ | noreply@sohayota.com | Sender email address |

## Security Checklist

- [ ] Change `SESSION_SECRET` from default (use strong random string)
- [ ] Use strong `ADMIN_PASSWORD` in production
- [ ] Enable HTTPS in production
- [ ] Configure CORS with specific allowed origins
- [ ] Set `NODE_ENV=production` in production
- [ ] Use environment-specific database credentials
- [ ] Enable database backups
- [ ] Set up rate limiting (configured in server/security.ts)
- [ ] Enable security headers (configured in server/security.ts)
- [ ] Regularly update dependencies: `npm audit fix`

## Database Schema

The application uses Drizzle ORM with PostgreSQL. Schema includes:

- **tenants**: Multi-tenant data isolation
- **users**: Authentication with bcrypt password hashing
- **customers**: Customer management with Bangladeshi phone support
- **tickets**: Issue tracking with status, priority, and assignment
- **messages**: Comments and ticket communications
- **phone_calls**: Call history and transcripts
- **notifications**: Multi-channel notification tracking

See `shared/schema.ts` for detailed schema definitions.

## API Endpoints

After setup, the API will be available at: `http://localhost:5000/api/`

Key endpoints:
- `POST /api/auth/login` - User login
- `GET /api/tickets` - List tickets
- `POST /api/tickets` - Create ticket
- `GET /api/customers` - List customers
- `GET /api/search` - Full-text search

For complete API documentation, see README.md

## Troubleshooting

### "Cannot connect to database"
- Check `DATABASE_URL` is correct
- Ensure PostgreSQL is running
- Verify database user has permission to create tables

### "SESSION_SECRET not set"
- Add `SESSION_SECRET` to `.env` or environment variables
- Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### "Port 5000 already in use"
- Change PORT in `.env`: `PORT=3001`
- Or kill existing process: `lsof -i :5000 | kill -9 <PID>`

### Email notifications not working
- For development: check server logs (emails logged to console)
- For production: configure `EMAIL_SERVICE` and `SENDGRID_API_KEY`

## Support

For issues or questions, please refer to the project documentation or contact the development team.
