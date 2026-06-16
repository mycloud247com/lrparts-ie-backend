import Redis from "ioredis";

class CacheService {
  constructor() {
    this.client = null;
    this.connected = false;
  }

  connect() {
    if (this.client) return;
    try {
      const redisUrl = process.env.REDIS_URL;
      const config = redisUrl
        ? { ...this.parseUrl(redisUrl), maxRetriesPerRequest: 3, retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 2000)) }
        : {
            host: process.env.REDIS_HOST || "localhost",
            port: parseInt(process.env.REDIS_PORT || "6379"),
            password: process.env.REDIS_PASSWORD || undefined,
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 2000)),
          };
      this.client = new Redis(config);
      this.client.on("connect", () => { this.connected = true; });
      this.client.on("error", () => { this.connected = false; });
    } catch {
      this.connected = false;
    }
  }

  async get(key) {
    if (!this.connected) return null;
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch { return null; }
  }

  async set(key, value, ttlSeconds = 7200) {
    if (!this.connected) return;
    try {
      await this.client.setex(key, ttlSeconds, JSON.stringify(value));
    } catch { /* silent */ }
  }

  async del(key) {
    if (!this.connected) return;
    try { await this.client.del(key); } catch { /* silent */ }
  }

  async flushPattern(pattern) {
    if (!this.connected) return;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) await this.client.del(...keys);
    } catch { /* silent */ }
  }

  parseUrl(url) {
    try {
      const u = new URL(url);
      return {
        host: u.hostname,
        port: parseInt(u.port || "6379"),
        password: u.password || undefined,
        username: u.username || undefined,
      };
    } catch {
      return { host: "localhost", port: 6379 };
    }
  }
}
export default new CacheService();
