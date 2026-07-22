/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REALTIME_URL?: string
  readonly VITE_AUTH_SESSION_SECRET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
