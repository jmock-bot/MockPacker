/// <reference types="vite/client" />

declare global {
  interface Window {
    /** Defined by public/theme.js — flips light/dark and persists the choice. */
    toggleTheme?: () => void;
  }
}

export {};
