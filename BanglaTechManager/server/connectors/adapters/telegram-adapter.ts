/**
 * Telegram Connector Adapter
 */

import { BaseConnectorAdapter } from "../base-adapter";

export class TelegramAdapter extends BaseConnectorAdapter {
  constructor() {
    super("telegram");
  }

  async testConnection(credentials: Record<string, any>): Promise<boolean> {
    try {
      const botToken = credentials.botToken || credentials.apiKey;
      if (!botToken) {
        throw new Error("Bot token required");
      }

      const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      
      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.ok && !!data.result;
    } catch (error: any) {
      throw new Error(`Telegram connection test failed: ${error.message}`);
    }
  }

  async refreshTokens(credentials: Record<string, any>): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  }> {
    // Telegram doesn't use OAuth tokens, just bot tokens
    throw new Error("Telegram does not support token refresh");
  }

  async normalizeWebhookEvent(eventType: string, payload: Record<string, any>): Promise<{
    type: string;
    data: Record<string, any>;
    timestamp: string;
  }> {
    // Telegram webhook format
    if (payload.message) {
      return {
        type: "message.received",
        data: {
          messageId: payload.message.message_id,
          chatId: payload.message.chat.id,
          fromId: payload.message.from?.id,
          text: payload.message.text,
          date: payload.message.date,
        },
        timestamp: new Date(payload.message.date * 1000).toISOString(),
      };
    }

    if (payload.callback_query) {
      return {
        type: "callback.received",
        data: {
          queryId: payload.callback_query.id,
          messageId: payload.callback_query.message?.message_id,
          data: payload.callback_query.data,
        },
        timestamp: new Date().toISOString(),
      };
    }

    return {
      type: eventType || "telegram.unknown",
      data: payload,
      timestamp: new Date().toISOString(),
    };
  }

  async performOutboundAction(
    action: string,
    credentials: Record<string, any>,
    data: Record<string, any>
  ): Promise<any> {
    const botToken = credentials.botToken || credentials.apiKey;
    if (!botToken) {
      throw new Error("Bot token required");
    }

    if (action === "send_message") {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: data.chatId,
          text: data.text,
          parse_mode: data.parseMode || "HTML",
          reply_to_message_id: data.replyToMessageId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to send message: ${error.description || response.statusText}`);
      }

      return await response.json();
    }

    throw new Error(`Unsupported action: ${action}`);
  }
}

