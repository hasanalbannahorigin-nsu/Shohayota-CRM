/**
 * Connector Adapter Factory
 * Creates adapter instances for connectors
 */

import { ConnectorAdapter } from "./base-adapter";
import { GmailAdapter } from "./adapters/gmail-adapter";
import { TelegramAdapter } from "./adapters/telegram-adapter";
import { SlackAdapter } from "./adapters/slack-adapter";
import { GitHubAdapter } from "./adapters/github-adapter";
import { StripeAdapter } from "./adapters/stripe-adapter";

const adapterRegistry: Record<string, () => ConnectorAdapter> = {
  gmail: () => new GmailAdapter(),
  telegram: () => new TelegramAdapter(),
  slack: () => new SlackAdapter(),
  github: () => new GitHubAdapter(),
  stripe: () => new StripeAdapter(),
};

/**
 * Get adapter instance for connector
 */
export function getAdapter(connectorId: string): ConnectorAdapter | null {
  const factory = adapterRegistry[connectorId];
  return factory ? factory() : null;
}

/**
 * Register adapter factory
 */
export function registerAdapter(connectorId: string, factory: () => ConnectorAdapter): void {
  adapterRegistry[connectorId] = factory;
}

