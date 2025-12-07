/**
 * Encryption Service
 * Handles encryption/decryption of sensitive data (integration credentials)
 * 
 * In production, use a proper KMS (Key Management Service) like AWS KMS, Azure Key Vault, etc.
 * For development, we use a simple encryption with a key from environment variables.
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;

// Get encryption key from environment or use a default for development
// In production, this should come from a secure key management service
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    console.warn("[SECURITY] ENCRYPTION_KEY not set. Using development key. DO NOT USE IN PRODUCTION!");
    // Development-only key - MUST be changed in production
    return crypto.scryptSync("dev-key-change-in-production", "salt", KEY_LENGTH);
  }
  
  // In production, derive key from environment variable
  return crypto.scryptSync(key, "tenant-encryption-salt", KEY_LENGTH);
}

/**
 * Encrypt sensitive data
 */
export function encrypt(data: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    const tag = cipher.getAuthTag();
    
    // Combine IV, tag, and encrypted data
    const result = {
      iv: iv.toString("hex"),
      tag: tag.toString("hex"),
      encrypted,
    };
    
    return JSON.stringify(result);
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedData: string): string {
  try {
    const key = getEncryptionKey();
    const data = JSON.parse(encryptedData);
    
    const iv = Buffer.from(data.iv, "hex");
    const tag = Buffer.from(data.tag, "hex");
    const encrypted = data.encrypted;
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt data");
  }
}

/**
 * Encrypt integration credentials object
 */
export function encryptCredentials(credentials: Record<string, any>): string {
  return encrypt(JSON.stringify(credentials));
}

/**
 * Decrypt integration credentials object
 */
export function decryptCredentials(encryptedCredentials: string): Record<string, any> {
  const decrypted = decrypt(encryptedCredentials);
  return JSON.parse(decrypted);
}

