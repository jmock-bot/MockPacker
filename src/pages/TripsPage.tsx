import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTrip } from '../context/TripContext';
import { useToast } from '../context/ToastContext';
import { daysUntil, shortDate } from '../lib/format';
import { Button, Card, Chip, ConfirmDialog, EmptyState, SectionTitle, Spinner } from '../components/ui';
import type { Trip } from '../lib/types';

const TYPE_ICONS: Record<Trip['trip_type'], string> = {
  personal: '🧍',
  family: '👨‍👩‍👧‍👦',
  business: '💼',
  romantic: '💞',
  group: '👥',
  event: '🎉',
};

export function TripsPage() {
  const { trips, tripsLoading, activeTrip, setActiveTripId, deleteTrip, seedDemo, redeemInvite } =
    useTrip();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState<Trip | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [seeding, setSeeding] = useState(false);

  if (tripsLoading) return <Spinner label="Loading trips" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">Trips</h1>
        <Button onClick={() => navigate('/trips/new')}>✚ Plan a Trip</Button>
      </div>

      {trips.length === 0 ? (
        <EmptyState
          icon="🧳"
          title="No trips yet"
          body="Plan your first trip, join one with an invitation code, or explore the demo."
          action={
            <Button
              variant="secondary"
              disabled={seeding}
              onClick={() => {
                setSeeding(true);
                void seedDemo().then((r) => {
                  setSeeding(false);
                  if (r.ok) toast('Demo trip loaded!', 'success');
                  else toast(r.error ?? 'Could not load the demo.', 'error');
                });
              }}
            >
              {seeding ? 'Loading…' : '✨ Load a demo trip'}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {trips.map((t) => {
            const dd = daysUntil(t.start_date);
            const isActive = activeTrip?.id === t.id;
            return (
              <Card key={t.id} accent={isActive ? '#0B6E6E' : undefined}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-bold text-ink">
                      <span aria-hidden="true">{TYPE_ICONS[t.trip_type]}</span>
                      <span className="truncate">{t.name}</span>
                      {t.is_demo && <Chip className="bg-maroon-tint text-maroon">Demo</Chip>}
                    </p>
                    <p className="text-sm text-ink-faint">
                      {[t.city, t.region].filter(Boolean).join(', ')}
                    </p>
                    <p className="text-xs text-ink-faint">
                      {shortDate(t.start_date)} – {shortDate(t.end_date)}
                      {dd != null && dd >= 0 && (
                        <span className="ml-2 font-semibold text-maroon">in {dd}d</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {isActive ? (
                    <Chip className="bg-emerald-100 text-emerald-800">Active trip</Chip>
                  ) : (
                    <Button
                      variant="secondary"
                      className="!min-h-[36px] px-3 text-xs"
                      onClick={() => {
                        setActiveTripId(t.id);
                        navigate('/');
                      }}
                    >
                      Open
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="!min-h-[36px] px-3 text-xs text-rose-700"
                    onClick={() => setConfirmDelete(t)}
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <SectionTitle>Join a trip with a code</SectionTitle>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!joinCode.trim()) return;
            void redeemInvite(joinCode).then((r) => {
              if (r.ok) {
                toast('You joined the trip! 🎉', 'success');
                setJoinCode('');
                navigate('/');
              } else toast(r.error ?? 'That code did not work.', 'error');
            });
          }}
        >
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Paste invitation code"
            aria-label="Invitation code"
            className="min-h-[44px] w-full rounded-xl border border-line bg-white px-3 text-base text-ink placeholder:text-ink-faint focus:border-maroon focus:outline-none focus:ring-2 focus:ring-maroon/15"
          />
          <Button type="submit" disabled={!joinCode.trim()} className="shrink-0">
            Join
          </Button>
        </form>
        <p className="mt-2 text-xs text-ink-faint">
          Or open the invitation link your organizer shared — it looks like{' '}
          <code>{window.location.origin}/join/…</code>
        </p>
      </Card>

      <p className="text-center text-xs text-ink-faint">
        Looking for your packing list? Open a trip, then head to{' '}
        <Link to="/packing" className="underline underline-offset-2">Packing</Link>.
      </p>

      <ConfirmDialog
        open={confirmDelete != null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete) return;
          void deleteTrip(confirmDelete.id).then((r) => {
            if (r.ok) toast('Trip deleted.', 'success');
            else toast(r.error ?? 'Only the trip owner can delete a trip.', 'error');
          });
        }}
        title={`Delete “${confirmDelete?.name ?? ''}”?`}
        body="This permanently removes the trip, its packing lists, photos, comments, and shipments for everyone in the group. This cannot be undone."
        confirmLabel="Delete trip"
      />
    </div>
  );
}
