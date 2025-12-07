/**
 * File Storage Service
 * Handles tenant-scoped file storage with tenant-prefixed paths
 */

import { storage } from "./storage";
import { insertFileSchema, type InsertFile } from "@shared/schema";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs/promises";
import { logAuditEvent } from "./audit-service";

export interface FileUploadResult {
  file: any;
  storagePath: string;
  url: string;
}

/**
 * Get storage directory for tenant
 */
function getTenantStoragePath(tenantId: string): string {
  return path.join(process.cwd(), "storage", "tenants", tenantId, "files");
}

/**
 * Generate tenant-prefixed storage path
 */
function generateStoragePath(tenantId: string, fileId: string, filename: string): string {
  return `tenants/${tenantId}/files/${fileId}/${filename}`;
}

/**
 * Upload file for tenant
 */
export async function uploadFile(
  tenantId: string,
  resourceType: string,
  resourceId: string,
  file: {
    filename: string;
    mimeType?: string;
    size: number;
    buffer: Buffer;
  },
  uploadedBy: string
): Promise<FileUploadResult> {
  const fileId = uuidv4();
  const storagePath = generateStoragePath(tenantId, fileId, file.filename);
  
  // Create directory structure
  const localPath = path.join(process.cwd(), "storage", storagePath);
  const dir = path.dirname(localPath);
  await fs.mkdir(dir, { recursive: true });
  
  // Write file
  await fs.writeFile(localPath, file.buffer);

  // Create file record
  const fileData = insertFileSchema.parse({
    tenantId,
    resourceType,
    resourceId,
    filename: fileId + path.extname(file.filename),
    originalFilename: file.filename,
    mimeType: file.mimeType || "application/octet-stream",
    size: file.size,
    storagePath,
    storageProvider: "local",
    uploadedBy,
  });

  const savedFile = await storage.createFile(fileData);

  // Log audit
  await logAuditEvent({
    tenantId,
    userId: uploadedBy,
    action: "create",
    resourceType: "file",
    resourceId: savedFile.id,
    details: { filename: file.filename, resourceType, resourceId },
  });

  return {
    file: savedFile,
    storagePath,
    url: `/api/files/${savedFile.id}`,
  };
}

/**
 * Get file by ID
 */
export async function getFile(fileId: string, tenantId: string): Promise<any> {
  const file = await storage.getFile(fileId, tenantId);
  if (!file) {
    throw new Error("File not found");
  }
  return file;
}

/**
 * Get files for a resource
 */
export async function getFilesForResource(
  resourceType: string,
  resourceId: string,
  tenantId: string
): Promise<any[]> {
  return await storage.getFilesByResource(resourceType, resourceId, tenantId);
}

/**
 * Delete file
 */
export async function deleteFile(fileId: string, tenantId: string, deletedBy: string): Promise<void> {
  const file = await storage.getFile(fileId, tenantId);
  if (!file) {
    throw new Error("File not found");
  }

  // Delete from storage
  try {
    const localPath = path.join(process.cwd(), "storage", file.storagePath);
    await fs.unlink(localPath);
  } catch (error) {
    console.warn("Failed to delete file from storage:", error);
  }

  // Delete record
  await storage.deleteFile(fileId, tenantId);

  // Log audit
  await logAuditEvent({
    tenantId,
    userId: deletedBy,
    action: "delete",
    resourceType: "file",
    resourceId: fileId,
    details: { filename: file.originalFilename },
  });
}

/**
 * Read file content
 */
export async function readFileContent(fileId: string, tenantId: string): Promise<Buffer> {
  const file = await storage.getFile(fileId, tenantId);
  if (!file) {
    throw new Error("File not found");
  }

  const localPath = path.join(process.cwd(), "storage", file.storagePath);
  return await fs.readFile(localPath);
}

