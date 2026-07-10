/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ITSM_AUTH_TOKEN?: string
  readonly VITE_ITSM_AUTH_COOKIE?: string
  readonly VITE_ITSM_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
