import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const memoryStore = new Map<string, unknown>()
const FILE_STORE_PATH = fileURLToPath(
  new URL('../.data/server-storage.json', import.meta.url),
)

function hasKvEnv(): boolean {
  return Boolean(
    process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
  )
}

function hasUpstashEnv(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN,
  )
}

export function isPersistentStorageEnabled(): boolean {
  return hasKvEnv() || hasUpstashEnv()
}

async function readFileStore(): Promise<Map<string, unknown>> {
  try {
    const raw = await readFile(FILE_STORE_PATH, 'utf8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return new Map(Object.entries(parsed))
  } catch {
    return new Map()
  }
}

async function writeFileStore(store: Map<string, unknown>): Promise<void> {
  await mkdir(dirname(FILE_STORE_PATH), { recursive: true })
  await writeFile(
    FILE_STORE_PATH,
    JSON.stringify(Object.fromEntries(store.entries())),
    'utf8',
  )
}

export async function readStorageJson<T>(key: string): Promise<T | null> {
  if (isPersistentStorageEnabled()) {
    try {
      const { kv } = await import('@vercel/kv')
      return (await kv.get<T>(key)) ?? null
    } catch (error) {
      console.error('[storage] KV read failed:', error)
      return null
    }
  }

  try {
    const store = await readFileStore()
    if (store.has(key)) {
      return store.get(key) as T
    }
  } catch (error) {
    console.error('[storage] File read failed:', error)
  }

  return (memoryStore.get(key) as T | undefined) ?? null
}

export async function writeStorageJson<T>(key: string, value: T): Promise<void> {
  if (isPersistentStorageEnabled()) {
    try {
      const { kv } = await import('@vercel/kv')
      await kv.set(key, value)
      return
    } catch (error) {
      console.error('[storage] KV write failed:', error)
      throw new Error('No se pudo guardar en el almacenamiento persistente')
    }
  }

  memoryStore.set(key, value)

  try {
    const store = await readFileStore()
    store.set(key, value)
    await writeFileStore(store)
  } catch (error) {
    console.error('[storage] File write failed:', error)
  }
}

export async function deleteStorageKey(key: string): Promise<void> {
  if (isPersistentStorageEnabled()) {
    try {
      const { kv } = await import('@vercel/kv')
      await kv.del(key)
      return
    } catch (error) {
      console.error('[storage] KV delete failed:', error)
    }
  }

  memoryStore.delete(key)

  try {
    const store = await readFileStore()
    if (!store.has(key)) return
    store.delete(key)
    await writeFileStore(store)
  } catch (error) {
    console.error('[storage] File delete failed:', error)
  }
}
