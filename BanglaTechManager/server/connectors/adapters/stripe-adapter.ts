/**
 * Stripe Connector Adapter
 */

import { BaseConnectorAdapter } from "../base-adapter";

export class StripeAdapter extends BaseConnectorAdapter {
  constructor() {
    super("stripe");
  }

  async testConnection(credentials: Record<string, any>): Promise<boolean> {
    try {
      const secretKey = credentials.secretKey || credentials.apiKey;
      if (!secretKey) {
        throw new Error("Stripe secret key required");
      }

      const response = await fetch("https://api.stripe.com/v1/account", {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Stripe API error: ${response.statusText}`);
      }

      const account = await response.json();
      return !!account.id;
    } catch (error: any) {
      throw new Error(`Stripe connection test failed: ${error.message}`);
    }
  }

  async refreshTokens(credentials: Record<string, any>): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  }> {
    // Stripe uses API keys, not OAuth tokens
    throw new Error("Stripe does not support token refresh");
  }

  async normalizeWebhookEvent(eventType: string, payload: Record<string, any>): Promise<{
    type: string;
    data: Record<string, any>;
    timestamp: string;
  }> {
    // Stripe webhook format
    const event = payload.data?.object || payload;

    return {
      type: `stripe.${eventType}`,
      data: {
        id: event.id,
        type: eventType,
        amount: event.amount,
        currency: event.currency,
        customer: event.customer,
        status: event.status,
        metadata: event.metadata,
      },
      timestamp: new Date(payload.created * 1000).toISOString(),
    };
  }
}

