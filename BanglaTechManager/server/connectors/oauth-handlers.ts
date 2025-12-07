/**
 * OAuth Handlers - Provider-specific OAuth token exchange
 */

import { getConnector } from "./registry";

const OAUTH_REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || "http://localhost:5000/api/connectors/oauth/callback";

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

/**
 * Exchange OAuth code for tokens (provider-specific)
 */
export async function exchangeOAuthCode(
  connectorId: string,
  code: string,
  tenantId: string
): Promise<OAuthTokenResponse> {
  const connector = getConnector(connectorId);
  if (!connector?.oauthEnabled) {
    throw new Error(`Connector ${connectorId} does not support OAuth`);
  }

  const clientId = process.env[`${connectorId.toUpperCase()}_CLIENT_ID`];
  const clientSecret = process.env[`${connectorId.toUpperCase()}_CLIENT_SECRET`];

  if (!clientId || !clientSecret) {
    throw new Error(`OAuth credentials not configured for ${connectorId}`);
  }

  // Provider-specific handlers
  switch (connectorId) {
    case "gmail":
    case "google_calendar":
    case "google_drive":
      return exchangeGoogleOAuth(code, clientId, clientSecret);
    
    case "slack":
      return exchangeSlackOAuth(code, clientId, clientSecret);
    
    case "github":
      return exchangeGitHubOAuth(code, clientId, clientSecret);
    
    case "jira":
      return exchangeJiraOAuth(code, clientId, clientSecret);
    
    case "paypal":
      return exchangePayPalOAuth(code, clientId, clientSecret);
    
    default:
      throw new Error(`OAuth handler not implemented for ${connectorId}`);
  }
}

async function exchangeGoogleOAuth(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<OAuthTokenResponse> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: OAUTH_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google OAuth token exchange failed: ${error}`);
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    token_type: data.token_type,
    scope: data.scope,
  };
}

async function exchangeSlackOAuth(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<OAuthTokenResponse> {
  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: OAUTH_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Slack OAuth token exchange failed: ${error}`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Slack OAuth error: ${data.error}`);
  }

  return {
    access_token: data.authed_user?.access_token || data.access_token,
    refresh_token: data.authed_user?.refresh_token,
    expires_in: data.authed_user?.expires_in,
    token_type: "Bearer",
    scope: data.scope,
  };
}

async function exchangeGitHubOAuth(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<OAuthTokenResponse> {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: OAUTH_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub OAuth token exchange failed: ${error}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
  }

  return {
    access_token: data.access_token,
    token_type: data.token_type,
    scope: data.scope,
  };
}

async function exchangeJiraOAuth(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<OAuthTokenResponse> {
  const response = await fetch("https://auth.atlassian.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: OAUTH_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Jira OAuth token exchange failed: ${error}`);
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    token_type: data.token_type,
    scope: data.scope,
  };
}

async function exchangePayPalOAuth(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<OAuthTokenResponse> {
  const baseUrl = process.env.PAYPAL_MODE === "live" 
    ? "https://api.paypal.com"
    : "https://api.sandbox.paypal.com";

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: OAUTH_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PayPal OAuth token exchange failed: ${error}`);
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    token_type: data.token_type,
    scope: data.scope,
  };
}

