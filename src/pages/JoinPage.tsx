import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTrip } from '../context/TripContext';
import { useToast } from '../context/ToastContext';
import { Button, Card, Field, TextInput, Warning } from '../components/ui';

/** Landing page for invitation links: /join/<code> (or /join?code=<code>). */
export function JoinPage() {
  const params = useParams();
  const [search] = useSearchParams();
  const { redeemInvite } = useTrip();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [code, setCode] = useState(params.code ?? search.get('code') ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    const res = await redeemInvite(code);
    setBusy(false);
    if (res.ok) {
      toast('Welcome aboard — you joined the trip! 🎉', 'success');
      navigate('/');
    } else {
      setError(res.error ?? 'That code did not work.');
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <Card>
        <div className="mb-4 text-center">
          <span aria-hidden="true" className="text-4xl">🧳</span>
          <h1 className="mt-2 text-xl font-bold text-ink">Join a trip</h1>
          <p className="text-sm text-ink-faint">
            Enter the invitation code from your trip organizer to join the group.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <Field label="Invitation code" required>
            {(id) => (
              <TextInput
                id={id}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. 4f9c2ab81d…"
                autoComplete="off"
              />
            )}
          </Field>
          {error && <Warning tone="rose">{error}</Warning>}
          <Button onClick={() => void join()} disabled={busy || !code.trim()}>
            {busy ? 'Joining…' : 'Join trip'}
          </Button>
          <Button variant="ghost" onClick={() => navigate('/')}>
            Skip for now
          </Button>
        </div>
      </Card>
    </div>
  );
}
