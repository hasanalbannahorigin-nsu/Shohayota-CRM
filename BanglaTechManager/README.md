# Sohayota CRM - Customer Relationship Management System

> সহায়তা (Sohayota) means "Support" in Bengali

A production-ready, multi-tenant Customer Relationship Management (CRM) system built for Bangladesh-based businesses with comprehensive ticket management, customer support, and business intelligence features.

## Features

### ✅ Core Features
- **Multi-Tenant Architecture**: Strict data isolation across 4+ tenants
- **Complete Ticket Management**: Create, assign, track, and resolve customer tickets
- **Customer Management**: Full CRUD with Bangladeshi phone number validation
- **Role-Based Access Control**: 4 roles (super_admin, tenant_admin, support_agent, customer)
- **JWT Authentication**: 7-day access + 30-day refresh token system
- **Full-Text Search**: Global search across customers, tickets, and messages

### 🔧 Advanced Features
- **Email Notifications**: Automated emails on ticket creation, assignment, and status changes
- **Real-Time Updates**: Instant status, priority, and assignment synchronization
- **Comments & Threading**: Full message threading on tickets
- **Analytics Dashboard**: Metrics for customer growth and agent performance
- **Security Middleware**: Rate limiting, security headers, CORS protection
- **Bangladeshi Support**: Phone validation, names, and formats
- **AI Assistant with Gemini**: Powered by Google Gemini LLM for intelligent CRM interactions
- **Model Context Protocol (MCP)**: Standardized protocol for AI assistants to access CRM data and tools

### 🛡️ Security
- Bcrypt password hashing (10 rounds)
- JWT token expiration and refresh
- **OAuth2/Keycloak Integration**: Support for OIDC JWT verification via JWKS
- **Local RS256 JWT**: Alternative JWT verification with public key
- Login rate limiting (5 attempts per 15 minutes)
- Security headers (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection)
- CORS configuration
- Multi-tenant isolation at all layers

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Create .env file
cp .env.example .env
# Edit .env with your database credentials

# 3. Run database migrations
npm run db:push

# 4. Seed initial data (optional)
npm run seed

# 5. Start development server
npm run dev
```

Server runs at: `http://localhost:5000`

### Production Deployment

```bash
# Set environment variables in your hosting provider
# (DATABASE_URL, SESSION_SECRET, NODE_ENV=production, ADMIN_PASSWORD)

npm run build
npm run db:push
npm run seed
npm run start
```

See [SETUP.md](./SETUP.md) for detailed setup instructions.
See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment guides (Replit, Railway, Render, Docker).

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout

### Customers
- `GET /api/customers` - List customers
- `GET /api/customers/:id` - Get customer details
- `POST /api/customers` - Create customer
- `PATCH /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer
- `GET /api/customers/search?q=...` - Search customers

### Tickets
- `GET /api/tickets` - List tickets
- `GET /api/tickets/:id` - Get ticket details
- `POST /api/tickets` - Create ticket
- `PATCH /api/tickets/:id` - Update ticket (status, priority, assignee)
- `DELETE /api/tickets/:id` - Delete ticket

### Messages
- `GET /api/tickets/:ticketId/messages` - Get ticket comments
- `POST /api/messages` - Add comment to ticket

### Search & Analytics
- `GET /api/search?q=...` - Full-text search
- `GET /api/analytics/stats` - Dashboard statistics

### System
- `GET /api/health` - Health check

## Sample Credentials

After seeding, use these credentials to login:

**Tenant Admin (Dhaka Tech Solutions):**
- Email: `admin@dhakatech.com`
- Password: `demo123` (change in production!)
- Role: `tenant_admin`

**Super Admin:**
- Email: `superadmin@sohayota.com`
- Password: `demo123` (change in production!)
- Role: `super_admin`

## Project Structure

```
├── server/
│   ├── index.ts              # Express server setup
│   ├── routes.ts             # API route definitions
│   ├── auth.ts               # JWT authentication & middleware
│   ├── storage.ts            # Database operations
│   ├── email-service.ts      # Email notifications
│   ├── security.ts           # Rate limiting & security headers
│   ├── validators.ts         # Input validation (Bangladeshi formats)
│   ├── seed.ts               # Database seeding utilities
│   ├── ai-assistant.ts       # AI query processing
│   ├── notification-service.ts # Multi-channel notifications
│   └── voice-service.ts      # Phone call integration
├── client/src/
│   ├── pages/                # React pages
│   ├── components/           # Reusable React components
│   ├── hooks/                # Custom React hooks
│   └── lib/                  # Utilities & helpers
├── shared/
│   └── schema.ts             # Database schema & types
├── seed.js                   # Node.js seed script
├── .env.example              # Environment variables template
├── SETUP.md                  # Development & production setup guide
├── DEPLOYMENT.md             # Deployment guides for various platforms
├── PRODUCTION_CHECKLIST.md   # Pre-deployment checklist
└── package.json              # Dependencies & scripts
```

## Database Schema

### Tables
- **tenants** - Multi-tenant data isolation
- **users** - User accounts with roles
- **customers** - Customer information
- **tickets** - Support tickets
- **messages** - Comments and communications
- **phone_calls** - Call history and transcripts
- **notifications** - Multi-channel notifications

See `shared/schema.ts` for detailed schema.

## Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Shadcn UI, Wouter
- **Backend**: Express.js, Node.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT with bcrypt password hashing
- **State Management**: TanStack React Query v5
- **Forms**: React Hook Form with Zod validation
- **UI Components**: Shadcn UI with Radix UI primitives
- **Icons**: Lucide React, React Icons

## Configuration

See `.env.example` for all available environment variables:

```env
DATABASE_URL=postgres://user:pass@host:5432/db_name
SESSION_SECRET=your-32-character-random-secret
NODE_ENV=development
PORT=5000
ADMIN_PASSWORD=demo123
FRONTEND_URL=http://localhost:5000

# OAuth2/Keycloak Configuration (Optional)
OAUTH_ISSUER=http://localhost:8080/realms/your-realm
OAUTH_CLIENT_ID=your-client-id

# Alternative: Local RS256 JWT Verification
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----...
```

### OAuth2/Keycloak Setup

For OAuth2 authentication with Keycloak, see [docs/KEYCLOAK_SETUP.md](./docs/KEYCLOAK_SETUP.md) for complete setup instructions including:
- Docker Compose configuration
- Keycloak realm and client setup
- Token mapper configuration
- Environment variable setup

## Security Checklist

- ✅ Rate limiting on login endpoints
- ✅ Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- ✅ Password hashing with bcrypt
- ✅ JWT token expiration
- ✅ CORS restrictions
- ✅ XSS protection
- ✅ Multi-tenant isolation
- ✅ Input validation with Bangladeshi phone support

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run db:push      # Run database migrations
npm run seed         # Seed initial data
npm run check        # Type check
```

## Support & Documentation

- **Setup**: See [SETUP.md](./SETUP.md)
- **Deployment**: See [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Checklist**: See [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)
- **Architecture**: See [replit.md](./replit.md)

## License

MIT

## Contributing

Contributions welcome! Please ensure:
- Code follows existing TypeScript conventions
- All features are tested
- Security best practices are followed
- Documentation is updated

---


