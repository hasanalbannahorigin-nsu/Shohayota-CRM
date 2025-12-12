// tests/ai-assistant.e2e.test.ts
import request from 'supertest';
import app from '../server/app'; // path to your express app
import nock from 'nock';

describe('AI Assistant', () => {
  it('falls back to rule-based if GEMINI not set', async () => {
    // create a test token that sets req.user.tenant_id via auth middleware OR mock middleware to set req.user
    const token = 'test-token-with-tenant'; // replace with helper to generate valid JWT
    // Optionally mock tenantMiddleware or bypass auth for tests
    const res = await request(app).post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: 'How many open tickets?' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.text).toBe('string');
    expect(res.body.data.provider).toBeDefined();
  });

  it('calls Gemini when configured (mocked)', async () => {
    // mock Gemini endpoint
    const gemini = nock('https://api.your-gemini-provider.example')
      .post('/v1/generate')
      .reply(200, { text: 'Gemini reply: ok' });

    const token = 'test-token-with-tenant';
    process.env.GEMINI_API_KEY = 'fake';
    process.env.GEMINI_API_URL = 'https://api.your-gemini-provider.example/v1/generate';

    const res = await request(app).post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: 'Summarize tickets' });

    expect(res.status).toBe(200);
    expect(res.body.data.provider).toBe('gemini');
    gemini.done();
  });
});
