/// <reference types="vite/client" />

// Env vars públicas del cliente (prefijo VITE_). Ver client/.env.example.
interface ImportMetaEnv {
  /** Base pública de la API para los ejemplos copiables de /partners/guia.
   *  Vacía → se usa el origen actual del navegador. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}