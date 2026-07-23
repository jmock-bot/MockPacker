import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button, Field, TextInput, Warning } from '../components/ui';

type Mode = 'signin' | 'signup' | 'magic' | 'reset';

const TAGLINES: Record<Mode, string> = {
  signin: 'Welcome back — your trip is waiting.',
  signup: 'Start planning the trip everyone actually enjoys.',
  magic: 'We’ll email you a one-tap sign-in link.',
  reset: 'We’ll email you a password reset link.',
};

export function LoginPage() {
  const { session, loading, signIn, signUp, signInWithProvider, sendMagicLink, sendPasswordReset } =
    useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from ?? '/';
  if (!loading && session) return <Navigate to={from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    let msg: string | null = null;
    if (mode === 'signin') msg = await signIn(email, password);
    else if (mode === 'signup') {
      if (!name.trim()) msg = 'Enter your name so your travel group knows who you are.';
      else msg = await signUp(email, password, name.trim());
      if (!msg) toast('Account created! Check your email if confirmation is required.', 'success');
    } else if (mode === 'magic') {
      msg = await sendMagicLink(email);
      if (!msg) toast('Magic link sent — check your inbox.', 'success');
    } else {
      msg = await sendPasswordReset(email);
      if (!msg) toast('Password reset email sent.', 'success');
    }
    setError(msg);
    setBusy(false);
  };

  const oauth = async (provider: 'google' | 'apple') => {
    setError(null);
    const msg = await signInWithProvider(provider);
    if (msg) setError(msg);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      {/* Hero — one simple promise */}
      <div className="bg-maroon px-6 pb-10 pt-[max(3rem,env(safe-area-inset-top))] text-center text-on-accent">
        <img
          src="/icons/icon-192.png"
          alt=""
          width={64}
          height={64}
          className="mx-auto mb-5 h-16 w-16 rounded-2xl shadow-raised"
        />
        <h1 className="mx-auto max-w-xs text-[1.75rem] font-bold leading-tight tracking-tight text-balance">
          Turning group chats into group trips.
        </h1>
      </div>

      <main className="mx-auto w-full max-w-md flex-1 px-6 py-8">
        <h2 className="text-lg font-bold text-ink">
          {mode === 'signup' ? 'Create your account' : mode === 'signin' ? 'Sign in' : mode === 'magic' ? 'Email me a link' : 'Reset password'}
        </h2>
        <p className="mb-5 text-sm text-ink-faint">{TAGLINES[mode]}</p>

        <div className="flex flex-col gap-2">
          <Button variant="secondary" onClick={() => void oauth('google')}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8z" />
              <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3a7.2 7.2 0 0 1-10.8-3.8H1.2v3.1A12 12 0 0 0 12 24z" />
              <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.2a12 12 0 0 0 0 10.8l4.1-3.1z" />
              <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8L20 3.2A12 12 0 0 0 1.2 6.6l4.1 3.1A7.2 7.2 0 0 1 12 4.8z" />
            </svg>
            Continue with Google
          </Button>
          <Button variant="secondary" onClick={() => void oauth('apple')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M16.7 12.9c0-2.4 2-3.6 2-3.6a4.4 4.4 0 0 0-3.5-1.9c-1.5-.1-2.9.9-3.6.9-.8 0-1.9-.9-3.2-.8a4.7 4.7 0 0 0-3.9 2.4c-1.7 2.9-.4 7.2 1.2 9.5.8 1.2 1.7 2.5 3 2.4 1.2 0 1.6-.8 3.1-.8s1.9.8 3.2.8 2.1-1.2 2.9-2.3a10 10 0 0 0 1.3-2.7 4.2 4.2 0 0 1-2.5-3.9zM14.1 5.2A4.2 4.2 0 0 0 15.1 2a4.3 4.3 0 0 0-2.8 1.5A4 4 0 0 0 11.3 6.6a3.6 3.6 0 0 0 2.8-1.4z" />
            </svg>
            Sign in with Apple
          </Button>
        </div>

        <div className="my-5 flex items-center gap-3 text-xs text-ink-faint" aria-hidden="true">
          <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
          {mode === 'signup' && (
            <Field label="Your name" required>
              {(id) => (
                <TextInput
                  id={id}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder="Alex Rivera"
                />
              )}
            </Field>
          )}
          <Field label="Email" required>
            {(id) => (
              <TextInput
                id={id}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
              />
            )}
          </Field>
          {(mode === 'signin' || mode === 'signup') && (
            <Field label="Password" required>
              {(id) => (
                <TextInput
                  id={id}
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  placeholder="At least 8 characters"
                />
              )}
            </Field>
          )}

          {error && <Warning tone="rose">{error}</Warning>}

          <Button type="submit" disabled={busy}>
            {busy
              ? 'One moment…'
              : mode === 'signin'
                ? 'Sign in'
                : mode === 'signup'
                  ? 'Create account'
                  : 'Send email'}
          </Button>
        </form>

        <div className="mt-5 flex flex-col gap-2 text-center text-sm">
          {mode === 'signin' ? (
            <>
              <button type="button" className="font-semibold text-maroon underline underline-offset-2" onClick={() => setMode('signup')}>
                New here? Create an account
              </button>
              <button type="button" className="text-ink-faint underline underline-offset-2" onClick={() => setMode('magic')}>
                Email me a magic link instead
              </button>
              <button type="button" className="text-ink-faint underline underline-offset-2" onClick={() => setMode('reset')}>
                Forgot password?
              </button>
            </>
          ) : (
            <button type="button" className="font-semibold text-maroon underline underline-offset-2" onClick={() => setMode('signin')}>
              Back to sign in
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
