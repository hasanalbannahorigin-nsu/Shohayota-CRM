# Sohayota CRM - Customer Relationship Management System

> সহায়তা (Sohayota) means "Support" in Bengali

A production-ready, multi-tenant Customer Relationship Management (CRM) system built for Bangladesh-based businesses with comprehensive ticket management, customer support, business intelligence, and AI-powered assistance features.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎯 Features

### ✅ Core Features

- **Multi-Tenant Architecture**: Strict data isolation across unlimited tenants
- **Complete Ticket Management**: Create, assign, track, and resolve customer tickets with full lifecycle support
- **Customer Management**: Full CRUD operations with Bangladeshi phone number validation and formatting
- **Role-Based Access Control (RBAC)**: 4 distinct roles (super_admin, tenant_admin, support_agent, customer)
- **JWT Authentication**: Secure 7-day access tokens + 30-day refresh token system
- **Full-Text Search**: Global search across customers, tickets, and messages
- **Real-Time Updates**: WebSocket-powered instant synchronization
- **Analytics Dashboard**: Comprehensive metrics for customer growth and agent performance

### 🤖 AI-Powered Features

- **Live AI Assistant with Gemini**: Real-time AI chat powered by Google Gemini LLM
  - Live WebSocket communication for instant responses
  - Speech-to-Text: Voice input via browser microphone
  - Text-to-Speech: Audio responses from AI
  - Context-aware responses using tenant CRM data
  - Fallback to rule-based responses when AI unavailable

- **Model Context Protocol (MCP)**: Standardized protocol for AI assistants
  - 9 CRM tools available via MCP (get_customer, search_tickets, create_ticket, etc.)
  - Secure HTTP endpoints for MCP-compatible AI assistants
  - Full tenant isolation and authentication
  - Works with Claude Desktop, ChatGPT, and other MCP clients

### 🔧 Advanced Features

- **Email Notifications**: Automated emails on ticket creation, assignment, and status changes
- **Real-Time Chat**: WebSocket-based live chat for instant communication
- **Comments & Threading**: Full message threading on tickets with rich text support
- **Phone Integration**: Call history, transcripts, and call-to-ticket linking
- **File Attachments**: Support for ticket attachments and file uploads
- **Security Middleware**: Rate limiting, security headers, CORS protection
- **Bangladeshi Support**: Phone validation, names, date formats, and currency
- **Customer Portal**: Self-service portal for customers to manage their tickets
- **Team Management**: Team creation, assignment, and collaboration features
- **Role Templates**: Customizable role permissions and templates

### 🛡️ Security Features

- **Bcrypt Password Hashing**: 10 rounds for secure password storage
- **JWT Token Expiration**: Automatic token refresh and expiration
- **OAuth2/Keycloak Integration**: Support for OIDC JWT verification via JWKS
- **Local RS256 JWT**: Alternative JWT verification with public key
- **Login Rate Limiting**: 5 attempts per 15 minutes to prevent brute force
- **Security Headers**: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection
- **CORS Configuration**: Restrictive CORS policies
- **Multi-Tenant Isolation**: Strict data isolation at all layers (database, API, middleware)
- **Input Validation**: Comprehensive validation with Zod schemas
- **SQL Injection Protection**: Parameterized queries and ORM usage

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **PostgreSQL** 14+ (or use Neon, Supabase, etc.)
- **npm** or **yarn** package manager
- **Git** for version control

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/hasanalbannahorigin-nsu/Shohayota-CRM.git
cd Shohayota-CRM/BanglaTechManager

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your configuration (see Configuration section)

# 4. Run database migrations
npm run db:push

# 5. Seed initial data (optional but recommended)
npm run seed

# 6. Start development server
npm run dev
```

The server will start at `http://localhost:5000`

### Sample Login Credentials

After running `npm run seed`, you can login with:

**Super Admin:**
- Email: `superadmin@sohayota.com`
- Password: `demo123`

**Tenant Admin (Dhaka Tech Solutions):**
- Email: `admin@dhakatech.com`
- Password: `demo123`

**Support Agent:**
- Email: `support@dhaka.com`
- Password: `demo123`

**Customer:**
- Email: `rahim.khan1@company.com`
- Password: `demo123`

⚠️ **Important**: Change all default passwords in production!

## 📚 Documentation

- **[Setup Guide](./SETUP.md)** - Detailed setup instructions
- **[Deployment Guide](./DEPLOYMENT.md)** - Deploy to Replit, Railway, Render, Docker
- **[MCP Protocol](./docs/MCP_PROTOCOL.md)** - Model Context Protocol documentation
- **[AI Assistant](./LIVE_CHAT_VOICE_UPDATE.md)** - Live chat and voice features
- **[Production Checklist](./PRODUCTION_CHECKLIST.md)** - Pre-deployment checklist

## 🔌 API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login (email/password) |
| GET | `/api/auth/me` | Get current authenticated user |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Logout (invalidate refresh token) |

### Customers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/customers` | List customers (paginated) |
| GET | `/api/customers/:id` | Get customer details |
| POST | `/api/customers` | Create new customer |
| PATCH | `/api/customers/:id` | Update customer |
| DELETE | `/api/customers/:id` | Delete customer |
| GET | `/api/customers/search?q=...` | Search customers |

### Tickets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tickets` | List tickets (with filters) |
| GET | `/api/tickets/:id` | Get ticket details |
| POST | `/api/tickets` | Create new ticket |
| PATCH | `/api/tickets/:id` | Update ticket (status, priority, assignee) |
| DELETE | `/api/tickets/:id` | Delete ticket |

### Messages

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tickets/:ticketId/messages` | Get ticket messages/comments |
| POST | `/api/messages` | Add message/comment to ticket |

### AI Assistant

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/ai/chat` | Chat with AI assistant (Gemini-powered) |
| GET | `/api/mcp/tools` | List MCP tools |
| POST | `/api/mcp/tools/call` | Execute MCP tool |
| GET | `/api/mcp/health` | MCP server health check |

### WebSocket

| Endpoint | Description |
|----------|-------------|
| `/ws/ai-chat?token=JWT_TOKEN` | WebSocket connection for live AI chat |

### Analytics & Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/search?q=...` | Full-text search (customers, tickets, messages) |
| GET | `/api/analytics/stats` | Dashboard statistics |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check endpoint |

## 🏗️ Architecture

### Project Structure

```
BanglaTechManager/
├── server/                      # Backend server code
│   ├── index.ts                # Express server setup
│   ├── routes.ts               # Main API route definitions
│   ├── auth.ts                 # JWT authentication & middleware
│   ├── storage.ts              # Database operations (in-memory & PostgreSQL)
│   ├── ai-assistant.ts         # Gemini AI integration
│   ├── websocket-server.ts     # WebSocket server for live chat
│   ├── mcp-handlers.ts         # MCP protocol handlers
│   ├── routes/                 # Route modules
│   │   ├── mcp-protocol.ts    # MCP endpoints
│   │   ├── api.ts             # API routes
│   │   └── ...
│   ├── middleware/             # Express middleware
│   │   ├── auth.ts            # Authentication middleware
│   │   ├── tenant.ts          # Tenant context middleware
│   │   └── ...
│   └── ...
├── client/src/                  # Frontend React application
│   ├── pages/                  # Page components
│   │   ├── ai-assistant-live.tsx  # AI Assistant with live chat
│   │   ├── dashboard.tsx      # Dashboard page
│   │   ├── customers.tsx      # Customer management
│   │   ├── tickets.tsx        # Ticket management
│   │   └── ...
│   ├── components/             # Reusable components
│   │   ├── ui/                # Shadcn UI components
│   │   ├── app-sidebar.tsx    # Main sidebar navigation
│   │   └── ...
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Utilities & helpers
│   └── ...
├── shared/                      # Shared code
│   └── schema.ts               # Database schema & TypeScript types
├── migrations/                  # Database migration files
├── docs/                        # Documentation
├── examples/                    # Example code
├── tests/                       # Test files
├── seed-permanent-accounts.ts  # Database seeding script
├── package.json                # Dependencies & scripts
└── README.md                   # This file
```

### Database Schema

Core tables:
- **tenants** - Multi-tenant data isolation
- **users** - User accounts with roles and authentication
- **customers** - Customer information and profiles
- **tickets** - Support tickets with status, priority, assignee
- **messages** - Ticket comments and communications
- **phone_calls** - Call history and transcripts
- **notifications** - Multi-channel notifications
- **ai_usage_logs** - AI assistant usage tracking
- **audit_logs** - System audit trail

See `shared/schema.ts` for complete schema definitions.

### Multi-Tenant Architecture

- **Row-Level Security**: Each record has a `tenant_id` column
- **Middleware Isolation**: All requests are automatically scoped to user's tenant
- **Database Queries**: All queries filtered by tenant_id
- **API Validation**: Tenant ID stripped from client requests (security)
- **Super Admin**: Can access multiple tenants with explicit tenant selection

## 💻 Technology Stack

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS framework
- **Shadcn UI** - High-quality component library
- **Wouter** - Lightweight routing
- **TanStack Query** - Server state management
- **React Hook Form** - Form handling
- **Zod** - Schema validation
- **Lucide React** - Icon library

### Backend
- **Node.js 18+** - Runtime
- **Express.js** - Web framework
- **TypeScript** - Type safety
- **PostgreSQL** - Primary database
- **Drizzle ORM** - Type-safe SQL ORM
- **JWT** - Authentication tokens
- **bcrypt** - Password hashing
- **WebSocket (ws)** - Real-time communication

### AI & Integration
- **Google Gemini API** - LLM for AI assistant
- **Model Context Protocol (MCP)** - AI assistant protocol
- **Web Speech API** - Browser speech recognition and synthesis

### Development Tools
- **Vite** - Build tool and dev server
- **ESBuild** - Fast bundler
- **TypeScript Compiler** - Type checking
- **Cross-env** - Environment variable handling

## ⚙️ Configuration

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5000

# Database
DATABASE_URL=postgres://user:password@localhost:5432/shohayota
# Or use individual variables:
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=your_password
PGDATABASE=shohayota

# Authentication
SESSION_SECRET=your-32-character-random-secret-key-here
JWT_SECRET=your-jwt-secret-key

# Gemini AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash-latest
AI_MAX_TOKENS_PER_REQUEST=2048
AI_TENANT_DAILY_QUOTA=10000
AI_RATE_LIMIT_PER_MIN=5

# Redis (Optional - for rate limiting and quotas)
REDIS_URL=redis://localhost:6379

# OAuth2/Keycloak (Optional)
OAUTH_ISSUER=http://localhost:8080/realms/your-realm
OAUTH_CLIENT_ID=your-client-id

# Alternative: Local RS256 JWT Verification
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----
...
-----END PUBLIC KEY-----
```

### Getting Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Get API Key" or "Create API Key"
4. Copy the key and add it to `.env` as `GEMINI_API_KEY`

## 📦 Available Scripts

```bash
# Development
npm run dev          # Start development server with hot reload
npm run check        # Type check without building

# Production
npm run build        # Build for production
npm run start        # Start production server

# Database
npm run db:push      # Run database migrations
npm run seed         # Seed initial data (tenants, users, customers, tickets)
```

## 🚢 Deployment

### Production Build

```bash
# 1. Set environment variables
export NODE_ENV=production
export DATABASE_URL=your_production_db_url
export SESSION_SECRET=your_secret_key

# 2. Build the application
npm run build

# 3. Run migrations
npm run db:push

# 4. Seed data (optional)
npm run seed

# 5. Start server
npm run start
```

### Deployment Platforms

- **Replit**: See [DEPLOYMENT.md](./DEPLOYMENT.md) for Replit setup
- **Railway**: See [DEPLOYMENT.md](./DEPLOYMENT.md) for Railway deployment
- **Render**: See [DEPLOYMENT.md](./DEPLOYMENT.md) for Render setup
- **Docker**: Use the included `Dockerfile` and `docker-compose.yml`

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions for each platform.

## 🔐 Security Best Practices

1. **Change Default Passwords**: Always change default passwords in production
2. **Use Strong Secrets**: Generate secure random strings for `SESSION_SECRET` and `JWT_SECRET`
3. **Enable HTTPS**: Always use HTTPS in production
4. **Database Security**: Use strong database passwords and restrict network access
5. **Rate Limiting**: Already enabled on login endpoints
6. **Input Validation**: All inputs are validated using Zod schemas
7. **SQL Injection**: Protected via parameterized queries and ORM
8. **XSS Protection**: Security headers prevent XSS attacks
9. **CORS**: Configure CORS to only allow your frontend domain
10. **Tenant Isolation**: Never trust client-sent tenant IDs

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Run specific test file
npm test -- tests/ai-assistant.e2e.test.ts

# Test MCP endpoints
npm test -- tests/mcp-protocol.test.ts
```

## 📖 Usage Examples

### Using AI Assistant

1. **Navigate to AI Assistant**: Click "AI Assistant" in the sidebar
2. **Type or Speak**: 
   - Type your question in the input field
   - Or click the microphone icon to speak
3. **Enable Voice Responses**: Click the speaker icon to hear AI responses
4. **Example Queries**:
   - "Show me open tickets"
   - "Customer summary"
   - "Generate report"
   - "What are high priority items?"

### Using MCP Protocol

```bash
# List available MCP tools
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:5000/api/mcp/tools

# Call an MCP tool (get analytics)
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "get_analytics", "arguments": {"period": "week"}}' \
  http://localhost:5000/api/mcp/tools/call
```

See [docs/MCP_PROTOCOL.md](./docs/MCP_PROTOCOL.md) for complete MCP documentation.

## 🐛 Troubleshooting

### Common Issues

**Issue**: WebSocket connection fails
- **Solution**: Ensure server is running and check JWT token is valid

**Issue**: Gemini AI not responding
- **Solution**: Check `GEMINI_API_KEY` is set in `.env` and is valid

**Issue**: Database connection errors
- **Solution**: Verify `DATABASE_URL` or PostgreSQL credentials in `.env`

**Issue**: Port 5000 already in use
- **Solution**: Change `PORT` in `.env` or stop the process using port 5000

**Issue**: Speech recognition not working
- **Solution**: Use Chrome/Edge browser (best Web Speech API support)

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Follow code style**: Use TypeScript conventions, proper typing
4. **Write tests**: Add tests for new features
5. **Update documentation**: Keep README and docs updated
6. **Commit changes**: Use clear, descriptive commit messages
7. **Push to branch**: `git push origin feature/amazing-feature`
8. **Open Pull Request**: Describe your changes clearly

### Code Style

- Use TypeScript strict mode
- Follow existing code patterns
- Add JSDoc comments for complex functions
- Use meaningful variable names
- Keep functions small and focused

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [React](https://reactjs.org/) and [Express.js](https://expressjs.com/)
- UI components from [Shadcn UI](https://ui.shadcn.com/)
- AI powered by [Google Gemini](https://gemini.google.com/)
- Icons from [Lucide](https://lucide.dev/)

## 📞 Support

- **Documentation**: Check the `/docs` folder for detailed guides
- **Issues**: Open an issue on GitHub for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions

## 🗺️ Roadmap

- [ ] Enhanced analytics with charts and graphs
- [ ] Mobile app (React Native)
- [ ] Advanced reporting and exports
- [ ] Email integration (Gmail, Outlook)
- [ ] SMS notifications
- [ ] WhatsApp integration
- [ ] Custom workflow automation
- [ ] Advanced RBAC with fine-grained permissions
- [ ] API rate limiting per tenant
- [ ] Multi-language support (Bengali, English)

---

**Made with ❤️ for Bangladesh-based businesses**

For detailed setup instructions, see [SETUP.md](./SETUP.md)
