/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GPU_VALIDATOR_CONTACT_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
