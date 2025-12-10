# AI/LLM Status in Codebase

## Summary

**The AI Assistant is currently HARDCODED with no actual LLM integration.**

## Current Implementation

### Main AI Assistant (`server/ai-assistant.ts`)
- **Status:** ✅ Implemented but **HARDCODED**
- **Technology:** Keyword matching + string templates
- **No LLM used:** Uses simple `if/else` statements to match keywords like "open tickets", "customer", "report", etc.
- **How it works:**
  1. Converts query to lowercase
  2. Checks for keywords (e.g., "open" + "ticket")
  3. Queries database for relevant data
  4. Formats response using template strings

### Advanced AI Services (Stubs/Mocks)

There are several AI service files with infrastructure for LLM integration, but they're all **mock implementations**:

1. **RAG Service** (`server/service/rag-service.ts`)
   - Has TODOs: "In production: use LLM to generate answer"
   - Currently returns hardcoded mock responses

2. **Bot Service** (`server/service/bot-service.ts`)
   - Has TODOs: "In production, use actual LLM or rule-based system"
   - Returns hardcoded FAQ responses

3. **Agent Assist Service** (`server/service/agent-assist-service.ts`)
   - Has TODOs: "In production, use LLM to generate suggestions"
   - Returns mock suggestions

4. **NLQ Service** (`server/service/nlq-service.ts`)
   - Has TODOs: "In production, use LLM to parse NL to query plan"
   - Mock implementation

5. **NLU Service** (`server/service/nlu-service.ts`)
   - Has TODOs for LLM integration
   - Mock implementation

6. **Transcription Service** (`server/service/transcription-service.ts`)
   - Mentions OpenAI Whisper API
   - Not implemented

## OpenAI Package Status

- **Package installed:** ✅ `"openai": "^6.8.1"` in `package.json`
- **Actually used:** ❌ **NO** - The package is installed but never imported or used anywhere
- **Why it exists:** Prepared for future LLM integration

## Database Schema

The schema does include AI-related tables:
- `ai_model_provider` enum with options: `openai`, `anthropic`, `azure`, `local`, `custom`
- Tables for tracking AI operations, costs, embeddings, etc.
- But these are not currently being used

## API Routes

The routes in `server/routes/ai.ts` expose endpoints like:
- `/api/ai/transcriptions`
- `/api/ai/nlu/parse`
- `/api/ai/bot/message`
- `/api/ai/assist`
- `/api/ai/summarize`
- `/api/ai/nlq`

**However**, these all call the mock services above that return hardcoded data.

## The Main AI Query Endpoint

The endpoint used by the frontend is:
- `POST /api/ai/query` in `server/routes.ts` (line ~1547)

This calls `createAIAssistant(tenantId).processQuery(query)` which is the hardcoded implementation.

## Conclusion

**No actual LLM is being used.** The AI assistant is a rule-based system using:
- Keyword matching
- String templates
- Database queries
- Hardcoded responses

The infrastructure for LLM integration exists (OpenAI package installed, service classes, database schema), but it's not implemented. All the advanced AI services are stubs with TODO comments indicating where LLM integration should be added.

