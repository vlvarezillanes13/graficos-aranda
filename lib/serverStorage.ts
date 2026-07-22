const memoryStore = new Map<string, unknown>()

export function isPersistentStorageEnabled(): boolean {
  return Boolean(
    process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
  )
}

export async function readStorageJson<T>(key: string): Promise<T | null> {
  if (isPersistentStorageEnabled()) {
    const { kv } = await import('@vercel/kv')
    return (await kv.get<T>(key)) ?? null
  }

  return (memoryStore.get(key) as T | undefined) ?? null
}

export async function writeStorageJson<T>(key: string, value: T): Promise<void> {
  if (isPersistentStorageEnabled()) {
    const { kv } = await import('@vercel/kv')
    await kv.set(key, value)
    return
  }

  memoryStore.set(key, value)
}

export async function deleteStorageKey(key: string): Promise<void> {
  if (isPersistentStorageEnabled()) {
    const { kv } = await import('@vercel/kv')
    await kv.del(key)
    return
  }

  memoryStore.delete(key)
}
