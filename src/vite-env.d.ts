/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly NEXT_PUBLIC_WEB3FORMS_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
