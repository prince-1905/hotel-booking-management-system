import Redis from "ioredis";

// REDIS_URL (e.g. rediss://default:pass@host:6379 from Upstash) wins; TLS is enabled
// automatically for rediss://. Falls back to REDIS_HOST/REDIS_PORT for local dev.
export const redis = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL)
    : new Redis({
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: Number(process.env.REDIS_PORT) || 6379
    });
