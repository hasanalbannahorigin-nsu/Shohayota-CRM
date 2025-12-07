// Email notification service
import { storage } from "./storage";

interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

export class EmailService {
  async sendTicketCreatedEmail(
    recipientEmail: string,
    ticketTitle: string,
    ticketId: string,
    customerName: string
  ): Promise<boolean> {
    try {
      const subject = `New Ticket Created: ${ticketTitle}`;
      const body = `
A new ticket has been created:
Ticket: ${ticketTitle}
ID: ${ticketId}
Customer: ${customerName}

Please review and assign to an agent.
      `;

      return await this.sendEmail({
        to: recipientEmail,
        subject,
        body,
        html: `
          <h2>New Ticket Created</h2>
          <p><strong>Ticket:</strong> ${ticketTitle}</p>
          <p><strong>ID:</strong> ${ticketId}</p>
          <p><strong>Customer:</strong> ${customerName}</p>
          <p>Please review and assign to an agent.</p>
        `,
      });
    } catch (error) {
      console.error("Error sending ticket created email:", error);
      return false;
    }
  }

  async sendTicketAssignedEmail(
    recipientEmail: string,
    agentName: string,
    ticketTitle: string,
    ticketId: string,
    customerName: string
  ): Promise<boolean> {
    try {
      const subject = `Ticket Assigned to You: ${ticketTitle}`;
      const body = `
Hello ${agentName},

You have been assigned a new ticket:
Ticket: ${ticketTitle}
ID: ${ticketId}
Customer: ${customerName}

Please review the ticket and take appropriate action.
      `;

      return await this.sendEmail({
        to: recipientEmail,
        subject,
        body,
        html: `
          <h2>Ticket Assigned to You</h2>
          <p>Hello <strong>${agentName}</strong>,</p>
          <p>You have been assigned a new ticket:</p>
          <p><strong>Ticket:</strong> ${ticketTitle}</p>
          <p><strong>ID:</strong> ${ticketId}</p>
          <p><strong>Customer:</strong> ${customerName}</p>
          <p>Please review the ticket and take appropriate action.</p>
        `,
      });
    } catch (error) {
      console.error("Error sending ticket assigned email:", error);
      return false;
    }
  }

  async sendPasswordResetEmail(
    recipientEmail: string,
    resetLink: string,
    userName: string
  ): Promise<boolean> {
    try {
      const subject = "Password Reset Request";
      const body = `
Hello ${userName},

We received a request to reset your password. Click the link below to reset it:
${resetLink}

This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
      `;

      return await this.sendEmail({
        to: recipientEmail,
        subject,
        body,
        html: `
          <h2>Password Reset Request</h2>
          <p>Hello <strong>${userName}</strong>,</p>
          <p>We received a request to reset your password. Click the button below to reset it:</p>
          <p><a href="${resetLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
          <p>This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.</p>
        `,
      });
    } catch (error) {
      console.error("Error sending password reset email:", error);
      return false;
    }
  }

  async sendTicketStatusChangeEmail(
    recipientEmail: string,
    customerName: string,
    ticketTitle: string,
    newStatus: string
  ): Promise<boolean> {
    try {
      const subject = `Ticket Status Update: ${ticketTitle}`;
      const body = `
Hello ${customerName},

Your ticket status has been updated:
Ticket: ${ticketTitle}
New Status: ${newStatus}

We're working on resolving your issue. Thank you for your patience.
      `;

      return await this.sendEmail({
        to: recipientEmail,
        subject,
        body,
        html: `
          <h2>Ticket Status Update</h2>
          <p>Hello <strong>${customerName}</strong>,</p>
          <p>Your ticket status has been updated:</p>
          <p><strong>Ticket:</strong> ${ticketTitle}</p>
          <p><strong>New Status:</strong> <span style="color: #28a745; font-weight: bold;">${newStatus}</span></p>
          <p>We're working on resolving your issue. Thank you for your patience.</p>
        `,
      });
    } catch (error) {
      console.error("Error sending status change email:", error);
      return false;
    }
  }

  private async sendEmail(payload: EmailPayload): Promise<boolean> {
    try {
      // Mock email sending - in production, use nodemailer, SendGrid, or AWS SES
      console.log(`📧 Email to ${payload.to}`);
      console.log(`   Subject: ${payload.subject}`);
      console.log(`   Body: ${payload.body.substring(0, 100)}...`);
      
      // In production, integrate with email provider:
      // const transporter = nodemailer.createTransport({...});
      // await transporter.sendMail({
      //   from: process.env.EMAIL_FROM,
      //   to: payload.to,
      //   subject: payload.subject,
      //   text: payload.body,
      //   html: payload.html,
      // });
      
      return true;
    } catch (error) {
      console.error("Email service error:", error);
      return false;
    }
  }
}

export const emailService = new EmailService();
