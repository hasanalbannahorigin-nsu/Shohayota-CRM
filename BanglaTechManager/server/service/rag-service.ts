/**
 * RAG Service
 * Retrieval-Augmented Generation: Knowledge Base with semantic search
 */

import { AIServiceBase, type AIOperationContext, type AIOperationResult } from "./ai-service-base";
import { db } from "../db";
import { storage } from "../storage";
import { kbDocuments, kbEmbeddings, type InsertKbDocument, type InsertKbEmbedding } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

export interface RAGQueryResult {
  answer: string;
  evidence: Array<{
    documentId: string;
    documentTitle: string;
    passage: string;
    relevance: number;
    startOffset?: number;
    endOffset?: number;
  }>;
  confidence: number;
}

export interface KBDocument {
  id: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
}

/**
 * RAG Service
 * Handles knowledge base documents and semantic search
 */
export class RAGService extends AIServiceBase {
  /**
   * Query knowledge base with RAG
   */
  async query(
    tenantId: string,
    question: string,
    options?: {
      maxResults?: number;
      minRelevance?: number;
      userId?: string;
    }
  ): Promise<RAGQueryResult> {
    await this.validateFeatureAccess(tenantId, "ragEnabled");

    const costCheck = await this.checkCostAndRateLimit(tenantId, 10);
    if (!costCheck.allowed) {
      throw new Error(costCheck.reason);
    }

    const startTime = Date.now();

    // TODO: In production:
    // 1. Generate embedding for question
    // 2. Search vector store for similar passages
    // 3. Retrieve top K passages
    // 4. Generate answer using LLM with retrieved passages as context

    // Mock implementation
    const evidence = [
      {
        documentId: "kb-001",
        documentTitle: "Password Reset Guide",
        passage: "To reset your password, navigate to Settings > Security > Reset Password and follow the prompts.",
        relevance: 0.92,
        startOffset: 0,
        endOffset: 100,
      },
    ];

    const answer = `Based on our knowledge base: ${evidence[0].passage}`;

    // Log operation
    await this.logAIOperation(
      {
        tenantId,
        userId: options?.userId,
        operationType: "rag",
        inputRef: question.substring(0, 100),
      },
      {
        success: true,
        latency: Date.now() - startTime,
        cost: 10,
        confidence: 92,
      },
      {
        provider: "openai",
        modelName: "gpt-4",
      }
    );

    await this.updateCostTracking(tenantId, 10);

    return {
      answer,
      evidence,
      confidence: 92,
    };
  }

  /**
   * Add document to knowledge base
   */
  async addDocument(
    tenantId: string,
    document: {
      title: string;
      content: string;
      category?: string;
      tags?: string[];
      sourceType?: string;
      sourceUrl?: string;
      attachmentId?: string;
    },
    userId?: string
  ): Promise<string> {
    await this.validateFeatureAccess(tenantId, "ragEnabled");

    const docData: InsertKbDocument = {
      tenantId,
      title: document.title,
      content: document.content,
      category: document.category,
      tags: document.tags || [],
      sourceType: document.sourceType || "manual",
      sourceUrl: document.sourceUrl,
      attachmentId: document.attachmentId,
      embedded: false, // Will be set to true after embedding
      createdBy: userId,
    };

    let docId: string;
    if (!db) {
      const memStorage = storage as any;
      if (!memStorage.kbDocuments) memStorage.kbDocuments = new Map();
      docId = crypto.randomUUID();
      memStorage.kbDocuments.set(docId, {
        id: docId,
        ...docData,
        version: 1,
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      const [doc] = await db.insert(kbDocuments).values(docData).returning();
      docId = doc.id;
    }

    // Start async embedding process
    this.createEmbeddings(docId, tenantId, document.content).catch((error) => {
      console.error(`Failed to create embeddings for document ${docId}:`, error);
    });

    return docId;
  }

  /**
   * Create embeddings for document (async)
   */
  private async createEmbeddings(docId: string, tenantId: string, content: string): Promise<void> {
    // TODO: In production:
    // 1. Chunk document into passages
    // 2. Generate embeddings for each passage
    // 3. Store embeddings in vector DB
    // 4. Update document.embedded = true

    // Mock implementation - would create embeddings here
    const chunks = this.chunkText(content, 500); // 500 char chunks

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embeddingData: InsertKbEmbedding = {
        tenantId,
        documentId: docId,
        passageText: chunk,
        passageStart: i * 500,
        passageEnd: (i + 1) * 500,
        embeddingModel: "text-embedding-ada-002",
        embedding: [], // Would contain actual embedding vector
      };

      if (!db) {
        const memStorage = storage as any;
        if (!memStorage.kbEmbeddings) memStorage.kbEmbeddings = new Map();
        const id = crypto.randomUUID();
        memStorage.kbEmbeddings.set(id, { id, ...embeddingData, createdAt: new Date() });
      } else {
        await db.insert(kbEmbeddings).values(embeddingData);
      }
    }

    // Mark document as embedded
    if (!db) {
      const memStorage = storage as any;
      const doc = memStorage.kbDocuments?.get(docId);
      if (doc) {
        doc.embedded = true;
        doc.embeddingModel = "text-embedding-ada-002";
      }
    } else {
      await db
        .update(kbDocuments)
        .set({ embedded: true, embeddingModel: "text-embedding-ada-002" })
        .where(eq(kbDocuments.id, docId));
    }
  }

  /**
   * Chunk text into passages
   */
  private chunkText(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.substring(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Get document
   */
  async getDocument(docId: string, tenantId: string): Promise<KBDocument | null> {
    if (!db) {
      const memStorage = storage as any;
      const doc = memStorage.kbDocuments?.get(docId);
      if (!doc || doc.tenantId !== tenantId) return null;
      return {
        id: doc.id,
        title: doc.title,
        content: doc.content,
        category: doc.category,
        tags: doc.tags || [],
      };
    }

    const [doc] = await db
      .select()
      .from(kbDocuments)
      .where(and(eq(kbDocuments.id, docId), eq(kbDocuments.tenantId, tenantId)))
      .limit(1);

    if (!doc) return null;

    return {
      id: doc.id,
      title: doc.title,
      content: doc.content,
      category: doc.category || undefined,
      tags: (doc.tags as any) || [],
    };
  }

  /**
   * Update document
   */
  async updateDocument(
    docId: string,
    tenantId: string,
    updates: {
      title: string;
      content: string;
      category?: string;
      tags?: string[];
    },
    userId?: string
  ): Promise<KBDocument | null> {
    if (!db) {
      const memStorage = storage as any;
      const doc = memStorage.kbDocuments?.get(docId);
      if (!doc || doc.tenantId !== tenantId) return null;

      const updated = {
        ...doc,
        title: updates.title,
        content: updates.content,
        category: updates.category,
        tags: updates.tags || [],
        updatedAt: new Date(),
        updatedBy: userId,
      };
      memStorage.kbDocuments.set(docId, updated);

      // Regenerate embeddings for updated content
      this.createEmbeddings(docId, tenantId, updates.content).catch((error) => {
        console.error(`Failed to recreate embeddings for document ${docId}:`, error);
      });

      return {
        id: updated.id,
        title: updated.title,
        content: updated.content,
        category: updated.category,
        tags: updated.tags || [],
      };
    }

    const [updated] = await db
      .update(kbDocuments)
      .set({
        title: updates.title,
        content: updates.content,
        category: updates.category,
        tags: updates.tags || [],
        updatedAt: new Date(),
        updatedBy: userId,
        embedded: false, // Will be re-embedded
      })
      .where(and(eq(kbDocuments.id, docId), eq(kbDocuments.tenantId, tenantId)))
      .returning();

    if (!updated) return null;

    // Regenerate embeddings for updated content
    this.createEmbeddings(docId, tenantId, updates.content).catch((error) => {
      console.error(`Failed to recreate embeddings for document ${docId}:`, error);
    });

    return {
      id: updated.id,
      title: updated.title,
      content: updated.content,
      category: updated.category || undefined,
      tags: (updated.tags as any) || [],
    };
  }

  /**
   * Delete document
   */
  async deleteDocument(docId: string, tenantId: string): Promise<void> {
    if (!db) {
      const memStorage = storage as any;
      const doc = memStorage.kbDocuments?.get(docId);
      if (doc && doc.tenantId === tenantId) {
        memStorage.kbDocuments.delete(docId);
        // Also delete embeddings
        Array.from(memStorage.kbEmbeddings?.values() || [])
          .filter((e: any) => e.documentId === docId)
          .forEach((e: any) => memStorage.kbEmbeddings.delete(e.id));
      }
      return;
    }

    // Delete embeddings first (cascade)
    await db.delete(kbEmbeddings).where(eq(kbEmbeddings.documentId, docId));
    // Delete document
    await db.delete(kbDocuments).where(eq(kbDocuments.id, docId));
  }

  /**
   * List documents
   */
  async listDocuments(tenantId: string, options?: { category?: string; limit?: number }): Promise<KBDocument[]> {
    if (!db) {
      const memStorage = storage as any;
      return Array.from(memStorage.kbDocuments?.values() || [])
        .filter((d: any) => d.tenantId === tenantId && (!options?.category || d.category === options.category))
        .slice(0, options?.limit || 100)
        .map((d: any) => ({
          id: d.id,
          title: d.title,
          content: d.content,
          category: d.category,
          tags: d.tags || [],
        }));
    }

    const conditions = [eq(kbDocuments.tenantId, tenantId)];
    if (options?.category) {
      conditions.push(eq(kbDocuments.category, options.category));
    }

    const docs = await db
      .select()
      .from(kbDocuments)
      .where(and(...conditions))
      .limit(options?.limit || 100);

    return docs.map((d) => ({
      id: d.id,
      title: d.title,
      content: d.content,
      category: d.category || undefined,
      tags: (d.tags as any) || [],
    }));
  }
}

