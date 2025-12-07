/**
 * GitHub Connector Adapter
 */

import { BaseConnectorAdapter } from "../base-adapter";

export class GitHubAdapter extends BaseConnectorAdapter {
  constructor() {
    super("github");
  }

  async testConnection(credentials: Record<string, any>): Promise<boolean> {
    try {
      const response = await this.makeAuthenticatedRequest(
        "https://api.github.com/user",
        credentials
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      const user = await response.json();
      return !!user.login;
    } catch (error: any) {
      throw new Error(`GitHub connection test failed: ${error.message}`);
    }
  }

  async refreshTokens(credentials: Record<string, any>): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  }> {
    // GitHub doesn't use refresh tokens in the same way
    // Tokens can be refreshed via OAuth app settings
    throw new Error("GitHub token refresh not supported via API");
  }

  async normalizeWebhookEvent(eventType: string, payload: Record<string, any>): Promise<{
    type: string;
    data: Record<string, any>;
    timestamp: string;
  }> {
    // GitHub webhook format
    const action = payload.action || "";
    const event = payload.issue || payload.pull_request || payload.repository;

    return {
      type: `github.${eventType}.${action}`,
      data: {
        id: event?.id || payload.id,
        number: event?.number,
        title: event?.title,
        body: event?.body,
        state: event?.state,
        url: event?.html_url,
        repository: payload.repository?.full_name,
        sender: payload.sender?.login,
      },
      timestamp: event?.updated_at || payload.updated_at || new Date().toISOString(),
    };
  }

  async syncInbound(credentials: Record<string, any>, cursor?: string): Promise<{
    items: any[];
    nextCursor?: string;
  }> {
    // Fetch issues
    const url = cursor
      ? `https://api.github.com/issues?page=${cursor}`
      : "https://api.github.com/issues?filter=all&per_page=50";

    const response = await this.makeAuthenticatedRequest(url, credentials);

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const issues = await response.json();
    const linkHeader = response.headers.get("Link");
    const nextPage = linkHeader?.match(/<([^>]+)>; rel="next"/)?.[1];

    return {
      items: issues.map((issue: any) => ({
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        url: issue.html_url,
        repository: issue.repository?.full_name,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
      })),
      nextCursor: nextPage ? new URL(nextPage).searchParams.get("page") || undefined : undefined,
    };
  }

  async performOutboundAction(
    action: string,
    credentials: Record<string, any>,
    data: Record<string, any>
  ): Promise<any> {
    if (action === "create_issue") {
      const [owner, repo] = data.repository.split("/");
      const response = await this.makeAuthenticatedRequest(
        `https://api.github.com/repos/${owner}/${repo}/issues`,
        credentials,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: data.title,
            body: data.body,
            labels: data.labels,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create issue: ${response.statusText}`);
      }

      return await response.json();
    }

    if (action === "create_comment") {
      const [owner, repo] = data.repository.split("/");
      const response = await this.makeAuthenticatedRequest(
        `https://api.github.com/repos/${owner}/${repo}/issues/${data.issueNumber}/comments`,
        credentials,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            body: data.body,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create comment: ${response.statusText}`);
      }

      return await response.json();
    }

    throw new Error(`Unsupported action: ${action}`);
  }
}

