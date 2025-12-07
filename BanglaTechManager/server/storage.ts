import {
  users,
  tenants,
  customers,
  tickets,
  messages,
  files,
  integrationCredentials,
  auditLogs,
  tenantUsageMetrics,
  roleTemplates,
  tenantRoles,
  type User,
  type Tenant,
  type Customer,
  type Ticket,
  type Message,
  type File,
  type IntegrationCredential,
  type AuditLog,
  type TenantUsageMetric,
  type RoleTemplate,
  type TenantRole,
  type InsertUser,
  type InsertTenant,
  type InsertCustomer,
  type InsertTicket,
  type InsertMessage,
  type InsertFile,
  type InsertIntegrationCredential,
  type InsertAuditLog,
  type InsertTenantUsageMetric,
  type InsertRoleTemplate,
  type InsertTenantRole,
} from "@shared/schema";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

export interface IStorage {
  // Tenant operations
  getTenant(id: string): Promise<Tenant | undefined>;
  getTenantByName(name: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, updates: Partial<Tenant>): Promise<Tenant | undefined>;
  
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsersByTenant(tenantId: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  
  // Customer operations
  getCustomer(id: string, tenantId: string): Promise<Customer | undefined>;
  getCustomersByTenant(tenantId: string, limit?: number, offset?: number): Promise<Customer[]>;
  searchCustomers(tenantId: string, query: string): Promise<Customer[]>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, tenantId: string, updates: Partial<Customer>): Promise<Customer | undefined>;
  deleteCustomer(id: string, tenantId: string): Promise<boolean>;
  
  // Ticket operations
  getTicket(id: string, tenantId: string): Promise<Ticket | undefined>;
  getTicketsByTenant(tenantId: string, status?: string): Promise<Ticket[]>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  updateTicket(id: string, tenantId: string, updates: Partial<Ticket>): Promise<Ticket | undefined>;
  deleteTicket(id: string, tenantId: string): Promise<boolean>;
  
  // Message operations
  getMessagesByTicket(ticketId: string, tenantId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  
  // File operations
  getFile(id: string, tenantId: string): Promise<File | undefined>;
  getFilesByResource(resourceType: string, resourceId: string, tenantId: string): Promise<File[]>;
  createFile(file: InsertFile): Promise<File>;
  deleteFile(id: string, tenantId: string): Promise<boolean>;
  
  // Integration credential operations
  getIntegrationCredential(tenantId: string, provider: string): Promise<IntegrationCredential | undefined>;
  getIntegrationCredentialsByTenant(tenantId: string): Promise<IntegrationCredential[]>;
  createIntegrationCredential(credential: InsertIntegrationCredential): Promise<IntegrationCredential>;
  updateIntegrationCredential(id: string, tenantId: string, updates: Partial<IntegrationCredential>): Promise<IntegrationCredential | undefined>;
  deleteIntegrationCredential(id: string, tenantId: string): Promise<boolean>;
  
  // Audit log operations
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(tenantId: string, options?: { limit?: number; offset?: number; resourceType?: string; action?: string; userId?: string }): Promise<AuditLog[]>;
  
  // Usage metrics operations
  getUsageMetrics(tenantId: string, period: string): Promise<TenantUsageMetric | undefined>;
  createOrUpdateUsageMetrics(metric: InsertTenantUsageMetric): Promise<TenantUsageMetric>;
  
  // Role template operations
  getRoleTemplate(name: string): Promise<RoleTemplate | undefined>;
  getAllRoleTemplates(): Promise<RoleTemplate[]>;
  createRoleTemplate(template: InsertRoleTemplate): Promise<RoleTemplate>;
  
  // Tenant role operations
  getTenantRole(tenantId: string, roleName: string): Promise<TenantRole | undefined>;
  getTenantRoles(tenantId: string): Promise<TenantRole[]>;
  createTenantRole(role: InsertTenantRole): Promise<TenantRole>;
  updateTenantRole(id: string, tenantId: string, updates: Partial<TenantRole>): Promise<TenantRole | undefined>;
}

import { v4 as uuidv4 } from "uuid";

export class MemStorage implements IStorage {
  public tenants: Map<string, Tenant> = new Map();
  public users: Map<string, User> = new Map();
  public customers: Map<string, Customer> = new Map();
  public tickets: Map<string, Ticket> = new Map();
  public messages: Map<string, Message> = new Map();
  public files: Map<string, File> = new Map();
  public integrationCredentials: Map<string, IntegrationCredential> = new Map();
  public auditLogs: Map<string, AuditLog> = new Map();
  public usageMetrics: Map<string, TenantUsageMetric> = new Map();
  public roleTemplates: Map<string, RoleTemplate> = new Map();
  public tenantRoles: Map<string, TenantRole> = new Map();

  private generateId(): string {
    return uuidv4();
  }

  // Tenant operations
  async getTenant(id: string): Promise<Tenant | undefined> {
    return this.tenants.get(id);
  }

  async getTenantByName(name: string): Promise<Tenant | undefined> {
    return Array.from(this.tenants.values()).find((t) => t.name === name);
  }

  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const tenantData = tenant as any;
    const newTenant: Tenant = {
      id: this.generateId(),
      name: tenant.name,
      slug: tenantData.slug || tenant.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      contactEmail: tenantData.contactEmail,
      status: tenantData.status || "active",
      plan: tenantData.plan || "basic",
      settings: tenantData.settings || {},
      quotaMaxUsers: tenantData.quotaMaxUsers || 10,
      quotaMaxCustomers: tenantData.quotaMaxCustomers || 1000,
      quotaMaxStorage: tenantData.quotaMaxStorage || 10737418240,
      quotaMaxApiCalls: tenantData.quotaMaxApiCalls || 10000,
      billingState: tenantData.billingState || "trial",
      trialEndsAt: tenantData.trialEndsAt || null,
      metadata: tenantData.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    this.tenants.set(newTenant.id, newTenant);
    return newTenant;
  }

  async updateTenant(id: string, updates: Partial<Tenant>): Promise<Tenant | undefined> {
    const tenant = this.tenants.get(id);
    if (!tenant) return undefined;
    
    const updated: Tenant = {
      ...tenant,
      ...updates,
      id: tenant.id,
      createdAt: tenant.createdAt,
    };
    this.tenants.set(id, updated);
    return updated;
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const lowerEmail = email.toLowerCase().trim();
    return Array.from(this.users.values()).find((u) => u.email.toLowerCase().trim() === lowerEmail);
  }

  async getUsersByTenant(tenantId: string): Promise<User[]> {
    return Array.from(this.users.values()).filter((u) => u.tenantId === tenantId);
  }

  async createUser(user: InsertUser): Promise<User> {
    const { password, ...userData } = user;
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    
    const newUser: User = {
      id: this.generateId(),
      ...userData,
      passwordHash,
      createdAt: new Date(),
    };
    this.users.set(newUser.id, newUser);
    return newUser;
  }

  // Customer operations
  async getCustomer(id: string, tenantId: string): Promise<Customer | undefined> {
    const customer = this.customers.get(id);
    return customer && customer.tenantId === tenantId ? customer : undefined;
  }

  async getCustomersByTenant(tenantId: string, limit = 50, offset = 0): Promise<Customer[]> {
    return Array.from(this.customers.values())
      .filter((c) => c.tenantId === tenantId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(offset, offset + limit);
  }

  async searchCustomers(tenantId: string, query: string): Promise<Customer[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.customers.values())
      .filter((c) => {
        if (c.tenantId !== tenantId) return false;
        return (
          c.name.toLowerCase().includes(lowerQuery) ||
          c.email.toLowerCase().includes(lowerQuery) ||
          (c.company?.toLowerCase().includes(lowerQuery) ?? false)
        );
      })
      .slice(0, 50);
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const newCustomer: Customer = {
      id: this.generateId(),
      tenantId: customer.tenantId,
      name: customer.name,
      email: customer.email,
      phone: customer.phone || null,
      company: customer.company || null,
      status: customer.status || "active",
      telegramId: customer.telegramId || null,
      createdAt: new Date(),
    };
    this.customers.set(newCustomer.id, newCustomer);
    return newCustomer;
  }

  async updateCustomer(id: string, tenantId: string, updates: Partial<Customer>): Promise<Customer | undefined> {
    const customer = this.customers.get(id);
    if (!customer || customer.tenantId !== tenantId) return undefined;
    
    const updated: Customer = {
      ...customer,
      ...updates,
      id: customer.id,
      tenantId: customer.tenantId,
      createdAt: customer.createdAt,
    };
    this.customers.set(id, updated);
    return updated;
  }

  async deleteCustomer(id: string, tenantId: string): Promise<boolean> {
    const customer = this.customers.get(id);
    if (!customer || customer.tenantId !== tenantId) return false;
    this.customers.delete(id);
    return true;
  }

  // Ticket operations
  async getTicket(id: string, tenantId: string): Promise<Ticket | undefined> {
    const ticket = this.tickets.get(id);
    return ticket && ticket.tenantId === tenantId ? ticket : undefined;
  }

  async getTicketsByTenant(tenantId: string, status?: string): Promise<Ticket[]> {
    let result = Array.from(this.tickets.values()).filter((t) => t.tenantId === tenantId);
    
    if (status) {
      result = result.filter((t) => t.status === status);
    }
    
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createTicket(ticket: InsertTicket): Promise<Ticket> {
    const newTicket: Ticket = {
      id: this.generateId(),
      tenantId: ticket.tenantId,
      customerId: ticket.customerId || null,
      assigneeId: ticket.assigneeId || null,
      title: ticket.title,
      description: ticket.description,
      category: ticket.category,
      status: ticket.status || "open",
      priority: ticket.priority || "medium",
      createdBy: ticket.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.tickets.set(newTicket.id, newTicket);
    return newTicket;
  }

  async updateTicket(id: string, tenantId: string, updates: Partial<Ticket>): Promise<Ticket | undefined> {
    const ticket = this.tickets.get(id);
    if (!ticket || ticket.tenantId !== tenantId) return undefined;
    
    const updated: Ticket = {
      ...ticket,
      ...updates,
      id: ticket.id,
      tenantId: ticket.tenantId,
      createdAt: ticket.createdAt,
      updatedAt: new Date(),
    };
    this.tickets.set(id, updated);
    return updated;
  }

  async deleteTicket(id: string, tenantId: string): Promise<boolean> {
    const ticket = this.tickets.get(id);
    if (!ticket || ticket.tenantId !== tenantId) return false;
    this.tickets.delete(id);
    return true;
  }

  // Message operations
  async getMessagesByTicket(ticketId: string, tenantId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter((m) => m.ticketId === ticketId && m.tenantId === tenantId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const newMessage: Message = {
      id: this.generateId(),
      tenantId: message.tenantId,
      ticketId: message.ticketId || null,
      senderId: message.senderId,
      content: message.content,
      timestamp: new Date(),
    };
    this.messages.set(newMessage.id, newMessage);
    return newMessage;
  }

  // File operations
  async getFile(id: string, tenantId: string): Promise<File | undefined> {
    const file = this.files.get(id);
    return file && file.tenantId === tenantId ? file : undefined;
  }

  async getFilesByResource(resourceType: string, resourceId: string, tenantId: string): Promise<File[]> {
    return Array.from(this.files.values())
      .filter((f) => f.tenantId === tenantId && f.resourceType === resourceType && f.resourceId === resourceId) as File[];
  }

  async createFile(file: InsertFile): Promise<File> {
    const newFile: File = {
      id: this.generateId(),
      tenantId: file.tenantId,
      resourceType: file.resourceType,
      resourceId: file.resourceId,
      filename: file.filename,
      originalFilename: file.originalFilename,
      mimeType: file.mimeType || null,
      size: file.size,
      storagePath: file.storagePath,
      storageProvider: file.storageProvider || "local",
      uploadedBy: file.uploadedBy,
      createdAt: new Date(),
    };
    this.files.set(newFile.id, newFile);
    return newFile;
  }

  async deleteFile(id: string, tenantId: string): Promise<boolean> {
    const file = this.files.get(id);
    if (!file || file.tenantId !== tenantId) return false;
    this.files.delete(id);
    return true;
  }

  // Integration credential operations
  async getIntegrationCredential(tenantId: string, provider: string): Promise<IntegrationCredential | undefined> {
    return Array.from(this.integrationCredentials.values())
      .find((c) => (c as IntegrationCredential).tenantId === tenantId && (c as IntegrationCredential).provider === provider) as IntegrationCredential | undefined;
  }

  async getIntegrationCredentialsByTenant(tenantId: string): Promise<IntegrationCredential[]> {
    return Array.from(this.integrationCredentials.values())
      .filter((c) => (c as IntegrationCredential).tenantId === tenantId) as IntegrationCredential[];
  }

  async createIntegrationCredential(credential: InsertIntegrationCredential): Promise<IntegrationCredential> {
    const newCredential: IntegrationCredential = {
      id: this.generateId(),
      tenantId: credential.tenantId,
      provider: credential.provider,
      encryptedCredentials: credential.encryptedCredentials,
      isActive: credential.isActive ?? true,
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.integrationCredentials.set(newCredential.id, newCredential);
    return newCredential;
  }

  async updateIntegrationCredential(id: string, tenantId: string, updates: Partial<IntegrationCredential>): Promise<IntegrationCredential | undefined> {
    const credential = this.integrationCredentials.get(id);
    if (!credential || credential.tenantId !== tenantId) return undefined;
    
    const updated: IntegrationCredential = {
      ...credential,
      ...updates,
      id: credential.id,
      tenantId: credential.tenantId,
      createdAt: credential.createdAt,
      updatedAt: new Date(),
    };
    this.integrationCredentials.set(id, updated);
    return updated;
  }

  async deleteIntegrationCredential(id: string, tenantId: string): Promise<boolean> {
    const credential = this.integrationCredentials.get(id);
    if (!credential || credential.tenantId !== tenantId) return false;
    this.integrationCredentials.delete(id);
    return true;
  }

  // Audit log operations
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const newLog: AuditLog = {
      id: this.generateId(),
      tenantId: log.tenantId,
      userId: log.userId || null,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId || null,
      details: log.details || null,
      ipAddress: log.ipAddress || null,
      userAgent: log.userAgent || null,
      impersonatedBy: log.impersonatedBy || null,
      createdAt: new Date(),
    };
    this.auditLogs.set(newLog.id, newLog);
    return newLog;
  }

  async getAuditLogs(tenantId: string, options: { limit?: number; offset?: number; resourceType?: string; action?: string; userId?: string } = {}): Promise<AuditLog[]> {
    let logs = Array.from(this.auditLogs.values())
      .filter((l) => l.tenantId === tenantId) as AuditLog[];

    if (options.resourceType) {
      logs = logs.filter((l) => l.resourceType === options.resourceType);
    }
    if (options.action) {
      logs = logs.filter((l) => l.action === options.action);
    }
    if (options.userId) {
      logs = logs.filter((l) => l.userId === options.userId);
    }

    return logs
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(options.offset || 0, (options.offset || 0) + (options.limit || 100));
  }

  // Usage metrics operations
  async getUsageMetrics(tenantId: string, period: string): Promise<TenantUsageMetric | undefined> {
    return Array.from(this.usageMetrics.values())
      .find((m) => (m as TenantUsageMetric).tenantId === tenantId && (m as TenantUsageMetric).period === period) as TenantUsageMetric | undefined;
  }

  async createOrUpdateUsageMetrics(metric: InsertTenantUsageMetric): Promise<TenantUsageMetric> {
    const existing = await this.getUsageMetrics(metric.tenantId, metric.period);
    if (existing) {
      const updated: TenantUsageMetric = {
        id: existing.id,
        tenantId: existing.tenantId,
        period: existing.period,
        apiCalls: metric.apiCalls ?? existing.apiCalls ?? 0,
        activeUsers: metric.activeUsers ?? existing.activeUsers ?? 0,
        storageUsed: metric.storageUsed ?? existing.storageUsed ?? 0,
        callMinutes: metric.callMinutes ?? existing.callMinutes ?? 0,
        messagesSent: metric.messagesSent ?? existing.messagesSent ?? 0,
        createdAt: existing.createdAt,
        updatedAt: new Date(),
      };
      this.usageMetrics.set(existing.id, updated);
      return updated;
    } else {
      const newMetric: TenantUsageMetric = {
        id: this.generateId(),
        tenantId: metric.tenantId,
        period: metric.period,
        apiCalls: metric.apiCalls ?? 0,
        activeUsers: metric.activeUsers ?? 0,
        storageUsed: metric.storageUsed ?? 0,
        callMinutes: metric.callMinutes ?? 0,
        messagesSent: metric.messagesSent ?? 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.usageMetrics.set(newMetric.id, newMetric);
      return newMetric;
    }
  }

  // Role template operations
  async getRoleTemplate(name: string): Promise<RoleTemplate | undefined> {
    return Array.from(this.roleTemplates.values()).find((t) => (t as RoleTemplate).name === name) as RoleTemplate | undefined;
  }

  async getAllRoleTemplates(): Promise<RoleTemplate[]> {
    return Array.from(this.roleTemplates.values()) as RoleTemplate[];
  }

  async createRoleTemplate(template: InsertRoleTemplate): Promise<RoleTemplate> {
    const newTemplate: RoleTemplate = {
      id: this.generateId(),
      name: template.name,
      displayName: template.displayName,
      description: template.description || null,
      permissions: template.permissions as {
        customers?: { read: boolean; create: boolean; update: boolean; delete: boolean };
        tickets?: { read: boolean; create: boolean; update: boolean; delete: boolean };
        users?: { read: boolean; create: boolean; update: boolean; delete: boolean };
        settings?: { read: boolean; update: boolean };
        analytics?: { read: boolean };
      },
      isSystem: template.isSystem ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.roleTemplates.set(newTemplate.id, newTemplate);
    return newTemplate;
  }

  // Tenant role operations
  async getTenantRole(tenantId: string, roleName: string): Promise<TenantRole | undefined> {
    return Array.from(this.tenantRoles.values())
      .find((r) => (r as TenantRole).tenantId === tenantId && (r as TenantRole).roleName === roleName) as TenantRole | undefined;
  }

  async getTenantRoles(tenantId: string): Promise<TenantRole[]> {
    return Array.from(this.tenantRoles.values())
      .filter((r) => r.tenantId === tenantId) as TenantRole[];
  }

  async createTenantRole(role: InsertTenantRole): Promise<TenantRole> {
    const roleId = this.generateId();
    const newRole: TenantRole = {
      id: roleId,
      tenantId: role.tenantId,
      roleName: role.roleName,
      displayName: role.displayName || null,
      permissions: role.permissions || null,
      isActive: role.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.tenantRoles.set(roleId, newRole);
    return newRole;
  }

  async updateTenantRole(id: string, tenantId: string, updates: Partial<TenantRole>): Promise<TenantRole | undefined> {
    const role = this.tenantRoles.get(id);
    if (!role) return undefined;
    const typedRole = role as TenantRole;
    if (typedRole.tenantId !== tenantId) return undefined;
    
    const updated: TenantRole = {
      ...typedRole,
      ...updates,
      id: typedRole.id,
      tenantId: typedRole.tenantId,
      createdAt: typedRole.createdAt,
      updatedAt: new Date(),
    };
    this.tenantRoles.set(id, updated);
    return updated;
  }

  // Helper to seed data
  async seed(seedData: { tenants: Tenant[]; users: User[]; customers: Customer[]; tickets: Ticket[] }) {
    for (const tenant of seedData.tenants) {
      this.tenants.set(tenant.id, tenant);
    }
    for (const user of seedData.users) {
      this.users.set(user.id, user);
    }
    for (const customer of seedData.customers) {
      this.customers.set(customer.id, customer);
    }
    for (const ticket of seedData.tickets) {
      this.tickets.set(ticket.id, ticket);
    }
  }
}

export const storage = new MemStorage();
