/**
 * AI Settings Service
 * Manages tenant AI configuration and settings updates
 */

import { db } from "../db";
import { storage } from "../storage";
import { aiSettings, type AiSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

export class AISettingsService {
  /**
   * Update tenant AI settings
   */
  async updateSettings(
    tenantId: string,
    updates: Partial<AiSettings>,
    updatedBy: string
  ): Promise<AiSettings> {
    if (!db) {
      // In-memory mode
      const memStorage = storage as any;
      const settings = memStorage.aiSettings?.get(tenantId);
      if (!settings) {
        throw new Error("AI settings not found");
      }
      Object.assign(settings, updates, {
        updatedBy,
        updatedAt: new Date(),
      });
      return settings;
    }

    const [updated] = await db
      .update(aiSettings)
      .set({
        ...updates,
        updatedBy,
        updatedAt: new Date(),
      })
      .where(eq(aiSettings.tenantId, tenantId))
      .returning();

    if (!updated) {
      throw new Error("AI settings not found");
    }

    return updated;
  }

  /**
   * Reset cost tracking (for daily/monthly resets)
   */
  async resetCostTracking(tenantId: string, period: "daily" | "monthly"): Promise<void> {
    if (!db) {
      const memStorage = storage as any;
      const settings = memStorage.aiSettings?.get(tenantId);
      if (settings) {
        if (period === "daily") {
          settings.currentDailyCost = 0;
          settings.costResetDate = new Date();
        } else {
          settings.currentMonthlyCost = 0;
        }
      }
      return;
    }

    const updateData: any = {
      costResetDate: new Date(),
    };

    if (period === "daily") {
      updateData.currentDailyCost = 0;
    } else {
      updateData.currentMonthlyCost = 0;
    }

    await db
      .update(aiSettings)
      .set(updateData)
      .where(eq(aiSettings.tenantId, tenantId));
  }
}

