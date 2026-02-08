/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_URL?: string;
  /** Injected at Amplify build (from AWS_BRANCH). Used for branch-based config. */
  readonly VITE_AMPLIFY_BRANCH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
