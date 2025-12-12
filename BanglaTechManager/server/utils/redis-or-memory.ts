// server/utils/redis-or-memory.ts
import Redis from 'ioredis';

export function getRedisOrMemory(redisUrl?: string) {
  if (redisUrl) {
    const client = new Redis(redisUrl);
    return { client, isRedis: true };
  }

  // in-memory fallback (not clustered)
  const store: Record<string, number> = {};
  return {
    client: {
      async get(key: string) { return String(store[key] || null); },
      async set(key: string, value: string, mode?: string, ex?: number) { store[key] = Number(value); return 'OK'; },
      async incr(key: string) { store[key] = (store[key] || 0) + 1; return store[key]; },
      async incrby(key: string, n: number) { store[key] = (store[key] || 0) + n; return store[key]; },
      async expire(_key: string, _sec: number) { return 1; },
      async del(key: string) { delete store[key]; return 1; }
    },
    isRedis: false
  };
}
