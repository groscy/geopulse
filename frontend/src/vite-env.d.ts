/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the GeoPulse API (M1). Unset => use reference fixtures. */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
