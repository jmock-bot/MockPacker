import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** Set shortly before removal so the toast can animate out. */
  leaving?: boolean;
}

const VISIBLE_MS = 4000;
const EXIT_MS = 180; // matches --dur-reveal

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => undefined });

export const useToast = () => useContext(ToastContext);

const KIND_STYLES: Record<ToastKind, string> = {
  success: 'bg-success text-white',
  error: 'bg-danger text-white',
  info: 'bg-ink text-paper',
  warning: 'bg-warning text-white',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = ++counter.current;
    setToasts((prev) => [...prev.slice(-2), { id, kind, message }]);
    // Flag the toast as leaving first so it can fade/slide out, then unmount it.
    window.setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, EXIT_MS);
    }, VISIBLE_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`motion-safe-transform pointer-events-auto max-w-md rounded-md px-4 py-3 text-body font-medium shadow-e3 transition-[opacity,transform] duration-reveal ease-accelerate ${
              t.leaving ? 'translate-y-[-8px] opacity-0' : 'animate-toast-in'
            } ${KIND_STYLES[t.kind]}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
