# Keycloak OAuth2 Integration Setup Guide

This guide explains how to set up Keycloak as an OAuth2/OIDC provider for JWT authentication in the Shohayota CRM application.

## Prerequisites

- Docker and Docker Compose (for local Keycloak setup)
- OR access to an existing Keycloak instance

## Option 1: Local Keycloak Setup with Docker Compose

### 1. Create Keycloak Docker Compose File

Create a `docker-compose.keycloak.yml` file in your project root:

```yaml
version: '3.8'

services:
  keycloak:
    image: quay.io/keycloak/keycloak:latest
    container_name: keycloak
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://keycloak-db:5432/keycloak
      KC_DB_USERNAME: keycloak
      KC_DB_PASSWORD: keycloak
    ports:
      - "8080:8080"
    command: start-dev
    depends_on:
      - keycloak-db
    networks:
      - keycloak-network

  keycloak-db:
    image: postgres:15-alpine
    container_name: keycloak-db
    environment:
      POSTGRES_DB: keycloak
      POSTGRES_USER: keycloak
      POSTGRES_PASSWORD: keycloak
    volumes:
      - keycloak_data:/var/lib/postgresql/data
    networks:
      - keycloak-network

volumes:
  keycloak_data:

networks:
  keycloak-network:
    driver: bridge
```

### 2. Start Keycloak

```bash
docker-compose -f docker-compose.keycloak.yml up -d
```

Wait for Keycloak to start (usually 30-60 seconds), then access:
- Admin Console: http://localhost:8080
- Username: `admin`
- Password: `admin`

## Option 2: Using Existing Keycloak Instance

If you have an existing Keycloak instance, note the following:
- **Issuer URL**: `http://your-keycloak-host:port/realms/your-realm-name`
- **Admin Console**: `http://your-keycloak-host:port/admin`

## Keycloak Realm and Client Configuration

### Step 1: Create a Realm

1. Log in to Keycloak Admin Console
2. Click on the realm dropdown (top left, usually shows "Master")
3. Click "Create Realm"
4. Enter realm name: `shohayota-crm` (or your preferred name)
5. Click "Create"

### Step 2: Create a Client

1. In your realm, go to **Clients** → **Create client**
2. **General Settings**:
   - **Client type**: `OpenID Connect`
   - **Client ID**: `shohayota-crm-client` (this will be your `OAUTH_CLIENT_ID`)
   - Click "Next"

3. **Capability config**:
   - **Client authentication**: `On` (for confidential clients) or `Off` (for public clients)
   - **Authorization**: `Off` (unless you need fine-grained permissions)
   - **Authentication flow**: Standard flow
   - Click "Next"

4. **Login settings**:
   - **Valid redirect URIs**: 
     - `http://localhost:5000/*` (for development)
     - `https://your-production-domain.com/*` (for production)
   - **Web origins**: 
     - `http://localhost:5000` (for development)
     - `https://your-production-domain.com` (for production)
   - **Valid post logout redirect URIs**: Same as redirect URIs
   - Click "Save"

### Step 3: Configure Client Settings

1. Go to **Clients** → Select your client (`shohayota-crm-client`)
2. **Settings** tab:
   - **Access Type**: `confidential` (recommended) or `public`
   - **Standard Flow Enabled**: `On`
   - **Direct Access Grants Enabled**: `On` (if you need password grant)
   - **Implicit Flow Enabled**: `Off` (deprecated)
   - **Service Accounts Enabled**: `On` (if you need service-to-service auth)
   - Click "Save"

3. **Credentials** tab (if confidential client):
   - Copy the **Client Secret** (you'll need this for client authentication)
   - Or generate a new secret if needed

### Step 4: Create Users and Assign Roles

1. Go to **Users** → **Create new user**
2. Fill in:
   - **Username**: `test-user`
   - **Email**: `test@example.com`
   - **Email Verified**: `On`
   - **First Name**: `Test`
   - **Last Name**: `User`
   - Click "Create"

3. Set password:
   - Go to **Credentials** tab
   - Set password (temporary: `Off` recommended)
   - Click "Set password"

4. Add tenant_id claim:
   - Go to **Attributes** tab
   - Add attribute:
     - **Key**: `tenant_id`
     - **Value**: `tenant-123` (your tenant ID)
   - Click "Save"

### Step 5: Configure Client Scopes and Mappers

1. Go to **Clients** → Your client → **Client scopes** tab
2. Click on **Dedicated scope** (e.g., `shohayota-crm-client-dedicated`)
3. Go to **Mappers** tab → **Add mapper** → **By configuration**
4. Add mappers:

   **Mapper 1: Tenant ID**
   - **Mapper type**: `User Attribute`
   - **Name**: `tenant_id`
   - **User Attribute**: `tenant_id`
   - **Token Claim Name**: `tenant_id`
   - **Claim JSON Type**: `String`
   - **Add to ID token**: `On`
   - **Add to access token**: `On`
   - **Add to userinfo**: `On`
   - Click "Save"

   **Mapper 2: Roles**
   - **Mapper type**: `User Realm Role`
   - **Name**: `realm-roles`
   - **Token Claim Name**: `roles`
   - **Add to ID token**: `On`
   - **Add to access token**: `On`
   - **Add to userinfo**: `On`
   - Click "Save"

### Step 6: Create Roles (Optional)

1. Go to **Realm roles** → **Create role**
2. Create roles like:
   - `tenant_admin`
   - `support_agent`
   - `customer`
   - `super_admin`

3. Assign roles to users:
   - Go to **Users** → Select user → **Role mapping** tab
   - Click "Assign role"
   - Select roles and assign

## Environment Configuration

Add the following environment variables to your `.env` file or deployment configuration:

```bash
# OAuth2 / Keycloak Configuration
OAUTH_ISSUER=http://localhost:8080/realms/shohayota-crm
OAUTH_CLIENT_ID=shohayota-crm-client

# Optional: If using confidential client
OAUTH_CLIENT_SECRET=your-client-secret-here
```

### For Production:

```bash
OAUTH_ISSUER=https://keycloak.yourdomain.com/realms/shohayota-crm
OAUTH_CLIENT_ID=shohayota-crm-client
OAUTH_CLIENT_SECRET=your-production-client-secret
```

## Alternative: Local RS256 JWT Verification

If you prefer to use local JWT verification instead of Keycloak:

1. Generate an RSA key pair:
```bash
# Generate private key
openssl genrsa -out private.pem 2048

# Generate public key
openssl rsa -in private.pem -pubout -out public.pem
```

2. Set environment variable:
```bash
JWT_PUBLIC_KEY="$(cat public.pem)"
```

3. The middleware will automatically use local JWT verification when `JWT_PUBLIC_KEY` is set and `OAUTH_ISSUER` is not set.

## Testing the Integration

### 1. Get an Access Token

Using Keycloak's token endpoint:

```bash
curl -X POST "http://localhost:8080/realms/shohayota-crm/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=shohayota-crm-client" \
  -d "client_secret=your-client-secret" \
  -d "username=test-user" \
  -d "password=your-password" \
  -d "grant_type=password"
```

Response:
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 300,
  "refresh_expires_in": 1800,
  "token_type": "Bearer"
}
```

### 2. Test Protected Route

```bash
curl -X GET "http://localhost:5000/api/tenants/current" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 3. Expected Token Claims

Your JWT token should contain:
```json
{
  "sub": "user-id",
  "email": "test@example.com",
  "name": "Test User",
  "tenant_id": "tenant-123",
  "roles": ["tenant_admin"],
  "aud": "shohayota-crm-client",
  "iss": "http://localhost:8080/realms/shohayota-crm"
}
```

## Troubleshooting

### Issue: "Invalid token" or "Token verification failed"

- Check that `OAUTH_ISSUER` matches your Keycloak realm URL exactly
- Verify the token hasn't expired
- Ensure the `aud` claim matches `OAUTH_CLIENT_ID`
- Check that the issuer (`iss`) claim matches `OAUTH_ISSUER`

### Issue: "Missing required claims"

- Ensure user has `tenant_id` attribute set
- Verify role mappers are configured correctly
- Check that claims are added to access token (not just ID token)

### Issue: JWKS endpoint not accessible

- Verify Keycloak is running and accessible
- Check that `.well-known/jwks.json` endpoint is reachable:
  ```bash
  curl http://localhost:8080/realms/shohayota-crm/.well-known/jwks.json
  ```

## Security Best Practices

1. **Use HTTPS in production** - Never use HTTP for OAuth2 in production
2. **Use confidential clients** - Enable client authentication for better security
3. **Set appropriate token expiration** - Configure reasonable access token lifetimes
4. **Rotate client secrets** - Regularly rotate client secrets
5. **Use realm roles** - Assign roles at the realm level for better management
6. **Enable token revocation** - Use refresh tokens and implement token revocation

## Additional Resources

- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [OAuth2 Specification](https://oauth.net/2/)
- [OpenID Connect Specification](https://openid.net/connect/)
- [JWKS Specification](https://tools.ietf.org/html/rfc7517)

