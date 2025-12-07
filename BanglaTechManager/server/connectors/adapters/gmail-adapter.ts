/**
 * Gmail Connector Adapter
 * Handles Gmail API operations, webhook normalization, and sync
 */

import { BaseConnectorAdapter } from "../base-adapter";

export class GmailAdapter extends BaseConnectorAdapter {
  constructor() {
    super("gmail");
  }

  async testConnection(credentials: Record<string, any>): Promise<boolean> {
    try {
      const response = await this.makeAuthenticatedRequest(
        "https://www.googleapis.com/gmail/v1/users/me/profile",
        credentials
      );

      if (!response.ok) {
        throw new Error(`Gmail API error: ${response.statusText}`);
      }

      const profile = await response.json();
      return !!profile.emailAddress;
    } catch (error: any) {
      console.error("Gmail connection test failed:", error);
      throw new Error(`Gmail connection test failed: ${error.message}`);
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

    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Gmail OAuth credentials not configured");
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
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
      refresh_token: credentials.refresh_token, // Google may not return new refresh token
      expires_in: data.expires_in,
    };
  }

  async normalizeWebhookEvent(eventType: string, payload: Record<string, any>): Promise<{
    type: string;
    data: Record<string, any>;
    timestamp: string;
  }> {
    // Gmail Pub/Sub webhook format
    if (payload.message?.data) {
      // Decode base64 message data
      const messageData = JSON.parse(
        Buffer.from(payload.message.data, "base64").toString()
      );

      return {
        type: "email.received",
        data: {
          messageId: messageData.emailAddress || messageData.historyId,
          historyId: messageData.historyId,
          emailAddress: messageData.emailAddress,
        },
        timestamp: new Date().toISOString(),
      };
    }

    // Fallback for other event types
    return {
      type: eventType || "email.unknown",
      data: payload,
      timestamp: new Date().toISOString(),
    };
  }

  async syncInbound(credentials: Record<string, any>, cursor?: string): Promise<{
    items: any[];
    nextCursor?: string;
  }> {
    // Fetch messages from Gmail
    const url = cursor
      ? `https://www.googleapis.com/gmail/v1/users/me/messages?pageToken=${cursor}`
      : "https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=50";

    const response = await this.makeAuthenticatedRequest(url, credentials);

    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.statusText}`);
    }

    const data = await response.json();
    const messages = data.messages || [];

    // Fetch full message details
    const messageDetails = await Promise.all(
      messages.map((msg: any) =>
        this.makeAuthenticatedRequest(
          `https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
          credentials
        ).then((r) => r.json())
      )
    );

    return {
      items: messageDetails.map((msg: any) => ({
        id: msg.id,
        threadId: msg.threadId,
        snippet: msg.snippet,
        payload: msg.payload,
        internalDate: msg.internalDate,
      })),
      nextCursor: data.nextPageToken,
    };
  }

  async performOutboundAction(
    action: string,
    credentials: Record<string, any>,
    data: Record<string, any>
  ): Promise<any> {
    if (action === "send_email") {
      // Send email via Gmail API
      const email = this.createEmailMessage(data);
      const encodedEmail = Buffer.from(email).toString("base64url");

      const response = await this.makeAuthenticatedRequest(
        "https://www.googleapis.com/gmail/v1/users/me/messages/send",
        credentials,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            raw: encodedEmail,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to send email: ${response.statusText}`);
      }

      return await response.json();
    }

    throw new Error(`Unsupported action: ${action}`);
  }

  private createEmailMessage(data: {
    to: string;
    subject: string;
    body: string;
    from?: string;
  }): string {
    const from = data.from || "noreply@example.com";
    const message = [
      `From: ${from}`,
      `To: ${data.to}`,
      `Subject: ${data.subject}`,
      "",
      data.body,
    ].join("\n");

    return message;
  }
}

