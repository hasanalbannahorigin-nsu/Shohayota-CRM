// Notification service for handling multiple channels: Email, SMS, Telegram
import { storage } from "./storage";

interface NotificationPayload {
  tenantId: string;
  customerId: string;
  title: string;
  content: string;
  type: "email" | "sms" | "telegram" | "in_app";
}

export class NotificationService {
  async sendNotification(payload: NotificationPayload): Promise<boolean> {
    try {
      const customer = await storage.getCustomer(payload.customerId, payload.tenantId);
      if (!customer) {
        console.error(`Customer ${payload.customerId} not found`);
        return false;
      }

      switch (payload.type) {
        case "email":
          return await this.sendEmailNotification(customer.email, payload);
        case "sms":
          return await this.sendSMSNotification(customer.phone || "", payload);
        case "telegram":
          return await this.sendTelegramNotification(customer.telegramId || "", payload);
        case "in_app":
          return await this.createInAppNotification(payload);
        default:
          return false;
      }
    } catch (error) {
      console.error("Notification error:", error);
      return false;
    }
  }

  private async sendEmailNotification(email: string, payload: NotificationPayload): Promise<boolean> {
    try {
      // Mock email sending
      console.log(`📧 Email to ${email}: ${payload.title}`);
      console.log(`   Content: ${payload.content}`);
      return true;
    } catch (error) {
      console.error("Email notification failed:", error);
      return false;
    }
  }

  private async sendSMSNotification(phone: string, payload: NotificationPayload): Promise<boolean> {
    try {
      // Mock SMS via Twilio (would use actual Twilio client in production)
      console.log(`📱 SMS to ${phone}: ${payload.title}`);
      console.log(`   Content: ${payload.content}`);
      return true;
    } catch (error) {
      console.error("SMS notification failed:", error);
      return false;
    }
  }

  private async sendTelegramNotification(telegramId: string, payload: NotificationPayload): Promise<boolean> {
    try {
      // Mock Telegram notification
      if (!telegramId) {
        console.log(`⚠️  No Telegram ID for customer`);
        return false;
      }
      console.log(`📨 Telegram to ${telegramId}: ${payload.title}`);
      console.log(`   Content: ${payload.content}`);
      return true;
    } catch (error) {
      console.error("Telegram notification failed:", error);
      return false;
    }
  }

  private async createInAppNotification(payload: NotificationPayload): Promise<boolean> {
    try {
      // In-app notifications stored in database
      console.log(`🔔 In-App notification: ${payload.title}`);
      return true;
    } catch (error) {
      console.error("In-app notification failed:", error);
      return false;
    }
  }

  // Broadcast to multiple channels
  async broadcastNotification(payload: Omit<NotificationPayload, "type">, channels: Array<"email" | "sms" | "telegram" | "in_app">): Promise<number> {
    let successCount = 0;
    for (const channel of channels) {
      const result = await this.sendNotification({
        ...payload,
        type: channel,
      });
      if (result) successCount++;
    }
    return successCount;
  }
}

export const notificationService = new NotificationService();
