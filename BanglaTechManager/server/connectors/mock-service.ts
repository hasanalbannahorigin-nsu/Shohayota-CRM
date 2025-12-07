/**
 * Mock/Test Mode Service
 * Simulates connector behavior for testing without real API calls
 */

import { Integration } from "@shared/schema";
import { getConnector } from "./registry";

export interface MockWebhookPayload {
  eventType: string;
  data: Record<string, any>;
}

const mockWebhookStore = new Map<string, MockWebhookPayload[]>();

/**
 * Simulate webhook for integration (test mode)
 */
export function simulateWebhook(
  integrationId: string,
  tenantId: string,
  payload: MockWebhookPayload
): void {
  const key = `${tenantId}:${integrationId}`;
  if (!mockWebhookStore.has(key)) {
    mockWebhookStore.set(key, []);
  }
  mockWebhookStore.get(key)!.push(payload);
}

/**
 * Get simulated webhooks for integration
 */
export function getSimulatedWebhooks(integrationId: string, tenantId: string): MockWebhookPayload[] {
  const key = `${tenantId}:${integrationId}`;
  return mockWebhookStore.get(key) || [];
}

/**
 * Clear simulated webhooks
 */
export function clearSimulatedWebhooks(integrationId: string, tenantId: string): void {
  const key = `${tenantId}:${integrationId}`;
  mockWebhookStore.delete(key);
}

/**
 * Generate mock webhook payload for connector
 */
export function generateMockWebhook(connectorId: string, eventType: string): MockWebhookPayload {
  const connector = getConnector(connectorId);
  if (!connector) {
    throw new Error(`Connector ${connectorId} not found`);
  }

  const mockPayloads: Record<string, Record<string, any>> = {
    gmail: {
      "email.received": {
        message: {
          data: Buffer.from(JSON.stringify({
            emailAddress: "test@example.com",
            historyId: "12345",
          })).toString("base64"),
        },
      },
    },
    telegram: {
      "message.received": {
        message: {
          message_id: Math.floor(Math.random() * 1000000),
          chat: { id: 123456789, type: "private" },
          from: { id: 987654321, first_name: "Test", username: "testuser" },
          text: "Test message",
          date: Math.floor(Date.now() / 1000),
        },
      },
    },
    slack: {
      "message.received": {
        event: {
          type: "message",
          text: "Test message",
          user: "U123456",
          channel: "C123456",
          ts: (Date.now() / 1000).toString(),
          event_ts: (Date.now() / 1000).toString(),
        },
        team_id: "T123456",
      },
    },
    github: {
      "issue.opened": {
        action: "opened",
        issue: {
          id: 12345,
          number: 1,
          title: "Test Issue",
          body: "This is a test issue",
          state: "open",
          html_url: "https://github.com/test/repo/issues/1",
        },
        repository: {
          full_name: "test/repo",
        },
        sender: {
          login: "testuser",
        },
      },
    },
    stripe: {
      "payment.succeeded": {
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_test123",
            amount: 2000,
            currency: "usd",
            status: "succeeded",
            customer: "cus_test123",
            metadata: {},
          },
        },
        created: Math.floor(Date.now() / 1000),
      },
    },
  };

  const connectorMocks = mockPayloads[connectorId];
  if (!connectorMocks) {
    return {
      eventType,
      data: {
        id: `mock_${Date.now()}`,
        type: eventType,
        timestamp: new Date().toISOString(),
      },
    };
  }

  const payload = connectorMocks[eventType] || connectorMocks[Object.keys(connectorMocks)[0]] || {};
  
  return {
    eventType,
    data: payload,
  };
}

/**
 * Simulate connector errors
 */
export function simulateError(errorType: "rate_limit" | "auth_failed" | "timeout" | "server_error"): {
  status: number;
  message: string;
} {
  switch (errorType) {
    case "rate_limit":
      return {
        status: 429,
        message: "Rate limit exceeded",
      };
    case "auth_failed":
      return {
        status: 401,
        message: "Authentication failed",
      };
    case "timeout":
      return {
        status: 504,
        message: "Request timeout",
      };
    case "server_error":
      return {
        status: 500,
        message: "Internal server error",
      };
    default:
      return {
        status: 500,
        message: "Unknown error",
      };
  }
}

