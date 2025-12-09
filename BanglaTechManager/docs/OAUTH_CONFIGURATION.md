# OAuth2 / Keycloak Configuration Quick Reference

## Environment Variables

### For Keycloak/OAuth2:
```bash
OAUTH_ISSUER=http://localhost:8080/realms/your-realm-name
OAUTH_CLIENT_ID=your-client-id
```

### For Local RS256 JWT:
```bash
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
...
-----END PUBLIC KEY-----"
```

## Keycloak Client Configuration

### Required Settings:
- **Client ID**: `shohayota-crm-client` (or your preferred name)
- **Client Type**: OpenID Connect
- **Valid Redirect URIs**: 
  - Development: `http://localhost:5000/*`
  - Production: `https://your-domain.com/*`
- **Web Origins**: 
  - Development: `http://localhost:5000`
  - Production: `https://your-domain.com`

### Required Token Mappers:
1. **tenant_id mapper** (User Attribute):
   - User Attribute: `tenant_id`
   - Token Claim Name: `tenant_id`
   - Add to access token: `On`

2. **roles mapper** (User Realm Role):
   - Token Claim Name: `roles`
   - Add to access token: `On`

## Testing

### Get Access Token:
```bash
curl -X POST "http://localhost:8080/realms/your-realm/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=your-client-id" \
  -d "client_secret=your-client-secret" \
  -d "username=test-user" \
  -d "password=test-password" \
  -d "grant_type=password"
```

### Use Token:
```bash
curl -X GET "http://localhost:5000/api/tenants/current" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

For detailed setup instructions, see [KEYCLOAK_SETUP.md](./KEYCLOAK_SETUP.md).

