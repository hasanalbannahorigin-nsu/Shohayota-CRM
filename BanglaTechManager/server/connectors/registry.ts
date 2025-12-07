/**
 * Connector Registry
 * Central catalog of available connectors with metadata
 */

export interface ConnectorCapabilities {
  inbound?: boolean;
  outbound?: boolean;
  bidirectional?: boolean;
  webhooks?: boolean;
  polling?: boolean;
  attachments?: boolean;
}

export interface ConnectorDefinition {
  id: string;
  displayName: string;
  description: string;
  category: "email" | "calendar" | "messaging" | "telephony" | "dev_tools" | "payments" | "storage" | "analytics" | "other";
  icon?: string;
  // OAuth configuration
  oauthEnabled: boolean;
  oauthAuthUrl?: string;
  oauthTokenUrl?: string;
  oauthScopes?: string[];
  // API configuration
  apiKeyRequired: boolean;
  webhookSupported: boolean;
  webhookDocsUrl?: string;
  // Capabilities
  capabilities: ConnectorCapabilities;
  // Status
  status: "active" | "inactive" | "deprecated" | "beta";
  // Metadata
  metadata?: Record<string, any>;
}

/**
 * Connector Registry - Central catalog of all available connectors
 */
export const CONNECTOR_REGISTRY: Record<string, ConnectorDefinition> = {
  // Email Providers
  gmail: {
    id: "gmail",
    displayName: "Gmail",
    description: "Connect Gmail to receive emails as tickets and send replies",
    category: "email",
    icon: "📧",
    oauthEnabled: true,
    oauthAuthUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    oauthTokenUrl: "https://oauth2.googleapis.com/token",
    oauthScopes: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.modify",
    ],
    apiKeyRequired: false,
    webhookSupported: true,
    webhookDocsUrl: "https://developers.google.com/gmail/api/guides/push",
    capabilities: {
      inbound: true,
      outbound: true,
      webhooks: true,
      polling: true,
      attachments: true,
    },
    status: "active",
  },

  // Calendar Providers
  google_calendar: {
    id: "google_calendar",
    displayName: "Google Calendar",
    description: "Sync calendar events and create reminders for tickets",
    category: "calendar",
    icon: "📅",
    oauthEnabled: true,
    oauthAuthUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    oauthTokenUrl: "https://oauth2.googleapis.com/token",
    oauthScopes: [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events",
    ],
    apiKeyRequired: false,
    webhookSupported: true,
    webhookDocsUrl: "https://developers.google.com/calendar/api/guides/push",
    capabilities: {
      inbound: true,
      outbound: true,
      webhooks: true,
      polling: true,
    },
    status: "active",
  },

  // Messaging Platforms
  telegram: {
    id: "telegram",
    displayName: "Telegram",
    description: "Connect Telegram bot to receive and send messages",
    category: "messaging",
    icon: "💬",
    oauthEnabled: false,
    apiKeyRequired: true, // Bot token
    webhookSupported: true,
    webhookDocsUrl: "https://core.telegram.org/bots/api#setwebhook",
    capabilities: {
      inbound: true,
      outbound: true,
      webhooks: true,
      attachments: true,
    },
    status: "active",
  },

  slack: {
    id: "slack",
    displayName: "Slack",
    description: "Connect Slack workspace for team notifications and messages",
    category: "messaging",
    icon: "💼",
    oauthEnabled: true,
    oauthAuthUrl: "https://slack.com/oauth/v2/authorize",
    oauthTokenUrl: "https://slack.com/api/oauth.v2.access",
    oauthScopes: [
      "channels:read",
      "chat:write",
      "im:read",
      "im:write",
      "users:read",
    ],
    apiKeyRequired: false,
    webhookSupported: true,
    webhookDocsUrl: "https://api.slack.com/apis/connections/events-api",
    capabilities: {
      inbound: true,
      outbound: true,
      webhooks: true,
      attachments: true,
    },
    status: "active",
  },

  whatsapp: {
    id: "whatsapp",
    displayName: "WhatsApp Business",
    description: "Connect WhatsApp Business API via Twilio or Meta",
    category: "messaging",
    icon: "📱",
    oauthEnabled: false,
    apiKeyRequired: true,
    webhookSupported: true,
    webhookDocsUrl: "https://www.twilio.com/docs/whatsapp/webhook",
    capabilities: {
      inbound: true,
      outbound: true,
      webhooks: true,
      attachments: true,
    },
    status: "active",
  },

  // Telephony
  twilio: {
    id: "twilio",
    displayName: "Twilio",
    description: "Phone calls, SMS, and WhatsApp via Twilio",
    category: "telephony",
    icon: "☎️",
    oauthEnabled: false,
    apiKeyRequired: true, // Account SID + Auth Token
    webhookSupported: true,
    webhookDocsUrl: "https://www.twilio.com/docs/usage/webhooks",
    capabilities: {
      inbound: true,
      outbound: true,
      webhooks: true,
    },
    status: "active",
  },

  // Dev Tools
  github: {
    id: "github",
    displayName: "GitHub",
    description: "Link GitHub issues and pull requests to tickets",
    category: "dev_tools",
    icon: "🐙",
    oauthEnabled: true,
    oauthAuthUrl: "https://github.com/login/oauth/authorize",
    oauthTokenUrl: "https://github.com/login/oauth/access_token",
    oauthScopes: ["repo", "issues", "pull_requests"],
    apiKeyRequired: false,
    webhookSupported: true,
    webhookDocsUrl: "https://docs.github.com/en/developers/webhooks-and-events/webhooks",
    capabilities: {
      inbound: true,
      outbound: true,
      webhooks: true,
      bidirectional: true,
    },
    status: "active",
  },

  jira: {
    id: "jira",
    displayName: "Jira",
    description: "Sync tickets with Jira issues",
    category: "dev_tools",
    icon: "🎯",
    oauthEnabled: true,
    oauthAuthUrl: "https://auth.atlassian.com/authorize",
    oauthTokenUrl: "https://auth.atlassian.com/oauth/token",
    oauthScopes: ["read:jira-work", "write:jira-work"],
    apiKeyRequired: false,
    webhookSupported: true,
    webhookDocsUrl: "https://developer.atlassian.com/cloud/jira/platform/webhooks/",
    capabilities: {
      inbound: true,
      outbound: true,
      webhooks: true,
      bidirectional: true,
    },
    status: "active",
  },

  // Payments
  stripe: {
    id: "stripe",
    displayName: "Stripe",
    description: "Receive payment webhooks and link invoices to tickets",
    category: "payments",
    icon: "💳",
    oauthEnabled: false,
    apiKeyRequired: true, // Secret key
    webhookSupported: true,
    webhookDocsUrl: "https://stripe.com/docs/webhooks",
    capabilities: {
      inbound: true,
      webhooks: true,
    },
    status: "active",
  },

  paypal: {
    id: "paypal",
    displayName: "PayPal",
    description: "Receive PayPal payment webhooks",
    category: "payments",
    icon: "💰",
    oauthEnabled: true,
    oauthAuthUrl: "https://www.paypal.com/connect",
    oauthTokenUrl: "https://api.paypal.com/v1/oauth2/token",
    oauthScopes: ["https://uri.paypal.com/services/invoicing"],
    apiKeyRequired: false,
    webhookSupported: true,
    webhookDocsUrl: "https://developer.paypal.com/docs/api-basics/notifications/webhooks/",
    capabilities: {
      inbound: true,
      webhooks: true,
    },
    status: "active",
  },

  // Storage
  google_drive: {
    id: "google_drive",
    displayName: "Google Drive",
    description: "Sync file attachments with Google Drive",
    category: "storage",
    icon: "📁",
    oauthEnabled: true,
    oauthAuthUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    oauthTokenUrl: "https://oauth2.googleapis.com/token",
    oauthScopes: [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/drive.file",
    ],
    apiKeyRequired: false,
    webhookSupported: true,
    webhookDocsUrl: "https://developers.google.com/drive/api/guides/push",
    capabilities: {
      inbound: true,
      outbound: true,
      webhooks: true,
      attachments: true,
    },
    status: "active",
  },

  // Generic
  generic_webhook: {
    id: "generic_webhook",
    displayName: "Generic Webhook",
    description: "Receive webhooks from any service",
    category: "other",
    icon: "🔗",
    oauthEnabled: false,
    apiKeyRequired: false,
    webhookSupported: true,
    capabilities: {
      inbound: true,
      webhooks: true,
    },
    status: "active",
  },
};

/**
 * Get all active connectors
 */
export function getActiveConnectors(): ConnectorDefinition[] {
  return Object.values(CONNECTOR_REGISTRY).filter((c) => c.status === "active");
}

/**
 * Get connector by ID
 */
export function getConnector(id: string): ConnectorDefinition | undefined {
  return CONNECTOR_REGISTRY[id];
}

/**
 * Get connectors by category
 */
export function getConnectorsByCategory(category: ConnectorDefinition["category"]): ConnectorDefinition[] {
  return Object.values(CONNECTOR_REGISTRY).filter((c) => c.category === category && c.status === "active");
}

