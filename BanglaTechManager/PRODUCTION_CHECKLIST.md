# Sohayota CRM - Production Deployment Checklist

## Pre-Deployment

### Code
- [ ] All features tested locally
- [ ] No console.log() statements left in production code
- [ ] Error handling properly implemented
- [ ] Sensitive data not hardcoded

### Database
- [ ] PostgreSQL 14+ available
- [ ] Database user created with proper permissions
- [ ] Backup strategy in place
- [ ] Connection string tested

### Environment
- [ ] SESSION_SECRET generated (32+ chars)
- [ ] ADMIN_PASSWORD set to secure value
- [ ] NODE_ENV set to "production"
- [ ] DATABASE_URL configured
- [ ] All required env vars set in hosting provider

## Deployment Steps

### 1. Code Deployment
- [ ] Push code to production branch
- [ ] Run: `npm install`
- [ ] Run: `npm run build`
- [ ] Build completes without errors

### 2. Database Setup
- [ ] Run: `npm run db:push` (migrations)
- [ ] All migrations successful
- [ ] Tables created correctly

### 3. Initial Data
- [ ] Run: `npm run seed`
- [ ] Admin users created
- [ ] Test login credentials work
- [ ] Update default admin password

### 4. Application Start
- [ ] Run: `npm run start`
- [ ] Application starts without errors
- [ ] Health check passes: `GET /api/health`
- [ ] API endpoints respond correctly

### 5. Security Verification
- [ ] HTTPS enabled
- [ ] Security headers present
- [ ] CORS properly configured
- [ ] Rate limiting working

## Post-Deployment

### Monitoring
- [ ] Application logs configured
- [ ] Error tracking enabled
- [ ] Performance monitoring active
- [ ] Database monitoring active

### Testing
- [ ] Login with admin account works
- [ ] Can create customer
- [ ] Can create ticket
- [ ] Email notifications functioning
- [ ] Search functionality working
- [ ] API pagination working

### Security
- [ ] Change default admin password immediately
- [ ] Verify no hardcoded credentials in logs
- [ ] Check for SQL injection vulnerabilities
- [ ] Verify XSS protection
- [ ] Rate limiting verified

### Backups
- [ ] Automated backups enabled
- [ ] Backup restoration tested
- [ ] Backup schedule verified

## Deployment Date: ___________
## Deployed By: ___________
## Notes: ___________
