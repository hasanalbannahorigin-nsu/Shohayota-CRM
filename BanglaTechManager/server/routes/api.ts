// server/routes/api.ts (or router file you use)
import express from 'express';
import { handleAiChat } from '../ai-assistant';
import { checkJwt } from '../middleware/auth'; // adjust import
import tenantMiddleware from '../middleware/tenant'; // adjust import

const router = express.Router();

// other routes...
router.post('/v1/ai/chat', checkJwt, tenantMiddleware, handleAiChat);

// keep legacy endpoint if exists
router.post('/ai/query', checkJwt, tenantMiddleware, handleAiChat);

export default router;
