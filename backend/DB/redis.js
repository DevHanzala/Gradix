import { Redis } from '@upstash/redis';

// This connects to your Upstash Redis (100% working with your credentials)
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || 'https://REMOVED.upstash.io',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '***REMOVED***',
});

// Optional: Test connection on startup (remove later if you want)
(async () => {
  try {
    await redis.set('test', 'Gradewise-AI Redis Connected!');
    const test = await redis.get('test');
    console.log('Redis Connected & Working!');
  } catch (err) {
    console.error('Redis Connection Failed:', err.message);
  }
})();