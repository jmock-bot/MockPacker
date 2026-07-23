import { useEffect, useState } from 'react';
import { Button, Modal } from './ui';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'mp-install-dismissed';

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * "Install the app" banner. Chrome/Edge/Android get the native install prompt
 * via beforeinstallprompt; iPhone/iPad get step-by-step Add to Home Screen
 * instructions (Safari has no install API). Hidden once installed or dismissed.
 */
export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      /* private mode */
    }
    if (dismissed) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    const onInstalled = () => setVisible(false);
    window.addEventListener('appinstalled', onInstalled);

    // iOS never fires beforeinstallprompt — offer instructions instead.
    if (isIos()) setVisible(true);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* best effort */
    }
  };

  const install = async () => {
    if (installEvent) {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === 'accepted') setVisible(false);
    } else {
      setShowIosHelp(true);
    }
  };

  if (!visible) return null;

  return (
    <>
      <div className="fixed inset-x-3 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 mx-auto max-w-md rounded-2xl border border-line bg-card p-3 shadow-raised lg:bottom-4 lg:right-4 lg:left-auto">
        <div className="flex items-center gap-3">
          <img src="/icons/icon-192.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink">Install MockPacker</p>
            <p className="text-xs text-ink-faint">Full-screen, with your packing list at the airport.</p>
          </div>
          <Button onClick={() => void install()} className="shrink-0 !min-h-[40px] px-3 text-xs">
            Install
          </Button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss install prompt"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-faint hover:bg-ink/5"
          >
            ✕
          </button>
        </div>
      </div>

      <Modal open={showIosHelp} onClose={() => setShowIosHelp(false)} title="Add to your Home Screen">
        <ol className="flex flex-col gap-4 text-sm text-ink-soft">
          <li className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-maroon text-xs font-bold text-on-accent">1</span>
            <span>
              Tap the <strong>Share</strong> button
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="mx-1 inline align-text-bottom" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 3v12M8 7l4-4 4 4M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              in Safari's toolbar.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-maroon text-xs font-bold text-on-accent">2</span>
            <span>Scroll down and tap <strong>Add to Home Screen</strong>.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-maroon text-xs font-bold text-on-accent">3</span>
            <span>Tap <strong>Add</strong>. MockPacker opens full-screen from your Home Screen.</span>
          </li>
        </ol>
        <Button className="mt-5 w-full" onClick={() => { setShowIosHelp(false); dismiss(); }}>
          Got it
        </Button>
      </Modal>
    </>
  );
}
