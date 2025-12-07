/**
 * Base Connector Adapter Interface
 * All connector adapters must implement this interface
 */

export interface ConnectorAdapter {
  /**
   * Test connection with credentials
   */
  testConnection(credentials: Record<string, any>): Promise<boolean>;

  /**
   * Refresh OAuth tokens
   */
  refreshTokens(credentials: Record<string, any>): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  }>;

  /**
   * Normalize webhook event to platform format
   */
  normalizeWebhookEvent(eventType: string, payload: Record<string, any>): Promise<{
    type: string;
    data: Record<string, any>;
    timestamp: string;
  }>;

  /**
   * Perform inbound sync (fetch data from provider)
   */
  syncInbound?(credentials: Record<string, any>, cursor?: string): Promise<{
    items: any[];
    nextCursor?: string;
  }>;

  /**
   * Perform outbound action (send data to provider)
   */
  performOutboundAction?(action: string, credentials: Record<string, any>, data: Record<string, any>): Promise<any>;
}

/**
 * Base adapter implementation with common functionality
 */
export abstract class BaseConnectorAdapter implements ConnectorAdapter {
  protected connectorId: string;

  constructor(connectorId: string) {
    this.connectorId = connectorId;
  }

  abstract testConnection(credentials: Record<string, any>): Promise<boolean>;
  abstract refreshTokens(credentials: Record<string, any>): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  }>;
  abstract normalizeWebhookEvent(eventType: string, payload: Record<string, any>): Promise<{
    type: string;
    data: Record<string, any>;
    timestamp: string;
  }>;

  /**
   * Handle rate limiting with exponential backoff
   */
  protected async handleRateLimit(
    fn: () => Promise<Response>,
    maxRetries = 3
  ): Promise<Response> {
    let retries = 0;
    let delay = 1000; // Start with 1 second

    while (retries < maxRetries) {
      try {
        const response = await fn();

        if (response.status === 429) {
          // Rate limited
          const retryAfter = response.headers.get("Retry-After");
          if (retryAfter) {
            delay = parseInt(retryAfter) * 1000;
          } else {
            delay *= 2; // Exponential backoff
          }

          if (retries < maxRetries - 1) {
            await new Promise((resolve) => setTimeout(resolve, delay));
            retries++;
            continue;
          }
        }

        return response;
      } catch (error) {
        if (retries < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
          retries++;
          continue;
        }
        throw error;
      }
    }

    throw new Error("Max retries exceeded");
  }

  /**
   * Make authenticated API request
   */
  protected async makeAuthenticatedRequest(
    url: string,
    credentials: Record<string, any>,
    options: RequestInit = {}
  ): Promise<Response> {
    const accessToken = credentials.access_token || credentials.apiKey || credentials.token;

    if (!accessToken) {
      throw new Error("No access token or API key found in credentials");
    }

    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);

    return this.handleRateLimit(() =>
      fetch(url, {
        ...options,
        headers,
      })
    );
  }
}

