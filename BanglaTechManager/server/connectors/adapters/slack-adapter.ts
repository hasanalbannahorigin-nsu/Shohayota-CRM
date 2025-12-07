/**
 * Slack Connector Adapter
 */

import { BaseConnectorAdapter } from "../base-adapter";

export class SlackAdapter extends BaseConnectorAdapter {
  constructor() {
    super("slack");
  }

  async testConnection(credentials: Record<string, any>): Promise<boolean> {
    try {
      const response = await this.makeAuthenticatedRequest(
        "https://slack.com/api/auth.test",
        credentials
      );

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.ok && !!data.user_id;
    } catch (error: any) {
      throw new Error(`Slack connection test failed: ${error.message}`);
    }
  }

  async refreshTokens(credentials: Record<string, any>): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  }> {
    if (!credentials.refresh_token) {
      throw new Error("No refresh token available");
    }

    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Slack OAuth credentials not configured");
    }

    const response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: credentials.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || credentials.refresh_token,
      expires_in: data.expires_in,
    };
  }

  async normalizeWebhookEvent(eventType: string, payload: Record<string, any>): Promise<{
    type: string;
    data: Record<string, any>;
    timestamp: string;
  }> {
    // Slack Events API format
    if (payload.event) {
      const event = payload.event;
      return {
        type: `slack.${event.type}`,
        data: {
          eventId: event.event_ts,
          channel: event.channel,
          user: event.user,
          text: event.text,
          ts: event.ts,
          team: payload.team_id,
        },
        timestamp: new Date(parseFloat(event.event_ts) * 1000).toISOString(),
      };
    }

    // Slack webhook format (legacy)
    if (payload.text) {
      return {
        type: "message.received",
        data: {
          text: payload.text,
          channel: payload.channel_name,
          user: payload.user_name,
          timestamp: payload.timestamp,
        },
        timestamp: new Date().toISOString(),
      };
    }

    return {
      type: eventType || "slack.unknown",
      data: payload,
      timestamp: new Date().toISOString(),
    };
  }

  async performOutboundAction(
    action: string,
    credentials: Record<string, any>,
    data: Record<string, any>
  ): Promise<any> {
    if (action === "post_message") {
      const response = await this.makeAuthenticatedRequest(
        "https://slack.com/api/chat.postMessage",
        credentials,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channel: data.channel,
            text: data.text,
            blocks: data.blocks,
            thread_ts: data.threadTs,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to post message: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.ok) {
        throw new Error(`Slack API error: ${result.error}`);
      }

      return result;
    }

    throw new Error(`Unsupported action: ${action}`);
  }
}

