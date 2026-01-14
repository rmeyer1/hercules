type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const cacheStore = new Map<string, CacheEntry<unknown>>();

const now = () => Date.now();

export const getCacheValue = <T>(key: string): T | null => {
  const entry = cacheStore.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (entry.expiresAt <= now()) {
    cacheStore.delete(key);
    return null;
  }
  return entry.value;
};

export const setCacheValue = <T>(key: string, value: T, ttlMs: number) => {
  cacheStore.set(key, { value, expiresAt: now() + ttlMs });
};

export const withCache = async <T>(key: string, ttlMs: number, loader: () => Promise<T>) => {
  const cached = getCacheValue<T>(key);
  if (cached !== null) return cached;
  const value = await loader();
  setCacheValue(key, value, ttlMs);
  return value;
};

// NOTE: In-memory cache for MVP. Replace with Redis in production for multi-node deployments.
