# Deployment Guide for Sohayota CRM

## Replit Deployment

### 1. Add Secrets in Replit UI

Go to **Tools > Secrets** in Replit and add:

```
DATABASE_URL = postgres://user:pass@host:5432/db_name
SESSION_SECRET = your-32-character-random-secret
ADMIN_PASSWORD = your-secure-password
NODE_ENV = production
```

### 2. Create Deployment Script

Create `.replit` file (if not exists):
```
run = "npm run start"
entrypoint = "server/index.ts"
```

Or update existing Replit configuration to run:
```
npm run build && npm run start
```

### 3. Deploy on Replit

1. Push to your Replit repository
2. Go to **Run** - your project will build and deploy
3. Access at the Replit-provided URL

---

## Railway Deployment

### 1. Create Railway Project

```bash
brew install railway  # or download from railway.app
railway login
railway init
```

### 2. Add PostgreSQL Database

```bash
railway add
# Select "PostgreSQL"
```

### 3. Set Environment Variables

```bash
railway variables set NODE_ENV=production
railway variables set SESSION_SECRET="your-32-char-secret"
railway variables set ADMIN_PASSWORD="your-password"
```

### 4. Deploy

```bash
railway up
```

---

## Render Deployment

### 1. Connect GitHub Repository

- Go to render.com
- Click "New +" > "Web Service"
- Connect your GitHub repository

### 2. Configure Build & Start Commands

**Build Command:**
```bash
npm install && npm run db:push && npm run build
```

**Start Command:**
```bash
npm run start
```

### 3. Add PostgreSQL Service

- Add a new "PostgreSQL" service
- Render will provide `DATABASE_URL` automatically

### 4. Set Environment Variables

In Render Dashboard > Environment:
```
SESSION_SECRET = your-32-char-secret
ADMIN_PASSWORD = your-secure-password
NODE_ENV = production
```

### 5. Deploy

Push to GitHub - Render will auto-deploy

---

## Docker Deployment

### Create Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

EXPOSE 5000

CMD ["npm", "run", "start"]
```

### Build & Run

```bash
docker build -t sohayota-crm .
docker run -p 5000:5000 \
  -e DATABASE_URL="..." \
  -e SESSION_SECRET="..." \
  sohayota-crm
```

---

## Post-Deployment Checklist

- [ ] Database migrations ran successfully
- [ ] Seed script executed (created initial admin)
- [ ] API health check passed: `GET /api/health`
- [ ] Login with admin credentials works
- [ ] Tickets can be created and updated
- [ ] Email notifications configured (if needed)
- [ ] Backups are scheduled
- [ ] Monitoring/logging is set up
- [ ] SSL certificate is valid
- [ ] CORS is properly configured
- [ ] Rate limiting is active
- [ ] Security headers are present

## Monitoring

### Check Application Health

```bash
curl https://your-app-url/api/health
```

Expected response:
```json
{"status":"ok","timestamp":"2025-11-23T10:00:00Z"}
```

### View Logs

**Replit:** View in Replit console
**Railway:** `railway logs`
**Render:** Dashboard > Logs
**Docker:** `docker logs <container-id>`

## Database Backups

### PostgreSQL Backups

```bash
# Backup
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

### Automated Backups

Most hosting providers offer automatic daily backups. Enable in your provider's dashboard.

## Scaling

For production with high traffic:

1. **Database**: Enable read replicas or upgrade plan
2. **App Instances**: Deploy multiple instances behind a load balancer
3. **Caching**: Add Redis for session and query caching
4. **Storage**: Use object storage (AWS S3, Cloudinary) for file uploads
5. **CDN**: Serve static assets from CDN

## Security in Production

✓ **Configured:**
- Rate limiting on login endpoints
- Security headers (X-Frame-Options, X-Content-Type-Options)
- CORS restrictions
- Password hashing with bcrypt
- JWT token expiration

**Recommended:**
- Enable HTTPS/TLS (automatic on most platforms)
- Set up WAF (Web Application Firewall)
- Enable database encryption
- Regular security audits
- Keep dependencies updated: `npm audit`

## Troubleshooting

### Application won't start
- Check logs for errors
- Verify DATABASE_URL is accessible
- Ensure SESSION_SECRET is set
- Run migrations: `npm run db:push`

### Database connection failed
- Verify DATABASE_URL format
- Check database user permissions
- Ensure IP whitelist allows connection
- Test connection: `psql $DATABASE_URL -c "SELECT 1"`

### Email not sending
- Verify EMAIL_SERVICE configuration
- Check SendGrid/SMTP credentials
- Review server logs for errors
- Test with: `curl -X POST /api/notifications/send`

---

## Support & Documentation

- **API Docs:** See README.md for endpoint reference
- **Setup Guide:** See SETUP.md for development setup
- **Project Structure:** See replit.md for architecture details

