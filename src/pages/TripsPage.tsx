import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTrip } from '../context/TripContext';
import { useToast } from '../context/ToastContext';
import { daysUntil, shortDate } from '../lib/format';
import {
  Button,
  Card,
  Chip,
  ConfirmDialog,
  EmptyState,
  SectionTitle,
  SkeletonCard,
  SkeletonScreen,
} from '../components/ui';
import { Icon, type IconName } from '../components/Icon';
import { ImportChatModal } from '../components/ImportChatModal';
import type { Trip } from '../lib/types';

const TYPE_ICONS: Record<Trip['trip_type'], IconName> = {
  personal: 'user',
  family: 'users',
  business: 'briefcase',
  romantic: 'heart',
  group: 'users',
  event: 'party',
};

export function TripsPage() {
  const { trips, tripsLoading, activeTrip, setActiveTripId, deleteTrip, seedDemo, redeemInvite } =
    useTrip();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState<Trip | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  if (tripsLoading)
    return (
      <SkeletonScreen label="Loading trips">
        <div className="grid gap-3 sm:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </SkeletonScreen>
    );

  return (
    <div className="flex flex-col gap-4">
      {/* Hero: how many trips you have. */}
      <header className="hero-glide flex items-end justify-between gap-3 pt-2">
        <div className="min-w-0">
          <h1 className="truncate text-label text-ink-soft">Trips{activeTrip ? ` · Active: ${activeTrip.name}` : ''}</h1>
          <p className="mt-1 text-ink">
            <span className="text-display tabular-nums">{trips.length}</span>{' '}
            <span className="text-body font-semibold text-ink-soft">trip{trips.length === 1 ? '' : 's'}</span>
          </p>
        </div>
        <Button className="shrink-0 whitespace-nowrap" onClick={() => navigate('/trips/new')}><Icon name="plus" size={16} /> Plan a Trip</Button>
      </header>

      <button
        type="button"
        onClick={() => setImportOpen(true)}
        className="plane-content motion-safe-transform flex min-h-[56px] items-center gap-3 rounded-lg px-4 py-3 text-left transition-[transform] duration-press ease-press active:scale-[.98]"
      >
        <Icon name="comment" size={20} className="shrink-0 text-ink-soft" />
        <span className="flex-1 text-body font-semibold text-ink">
          Or create a trip from a group chat
        </span>
        <Icon name="chevron-right" size={18} className="shrink-0 text-accent" />
      </button>
      <ImportChatModal open={importOpen} onClose={() => setImportOpen(false)} />

      {trips.length === 0 ? (
        <EmptyState
          icon="briefcase"
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
              {seeding ? 'Loading…' : <><Icon name="sparkle" size={16} /> Load a demo trip</>}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {trips.map((t) => {
            const dd = daysUntil(t.start_date);
            const isActive = activeTrip?.id === t.id;
            return (
              <Card key={t.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-body font-bold text-ink">
                      <Icon name={TYPE_ICONS[t.trip_type]} size={18} className="shrink-0 text-ink-soft" />
                      <span className="truncate">{t.name}</span>
                      {t.is_demo && <Chip tone="info">Demo</Chip>}
                    </p>
                    <p className="text-body text-ink-faint">
                      {[t.city, t.region].filter(Boolean).join(', ')}
                    </p>
                    <p className="text-caption text-ink-faint">
                      {shortDate(t.start_date)} – {shortDate(t.end_date)}
                      {dd != null && dd >= 0 && (
                        <span className="ml-2 font-semibold text-ink">in {dd}d</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {isActive ? (
                    <Chip tone="success">Active trip</Chip>
                  ) : (
                    <Button
                      variant="secondary"
                      className=" px-3 text-caption"
                      onClick={() => {
                        setActiveTripId(t.id);
                        navigate('/');
                      }}
                    >
                      Open
                    </Button>
                  )}
                  <Button
                    variant="tertiary"
                    className=" px-3 text-caption text-danger"
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
                toast('You joined the trip!', 'success');
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
            className="min-h-[44px] w-full rounded-xl border border-line-control bg-card px-3 text-body text-ink placeholder:text-ink-soft focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
          />
          <Button type="submit" disabled={!joinCode.trim()} className="shrink-0">
            Join
          </Button>
        </form>
        <p className="mt-2 text-caption text-ink-faint">
          Or open the invitation link your organizer shared — it looks like{' '}
          <code className="break-all">{window.location.origin}/join/…</code>
        </p>
      </Card>

      <p className="text-center text-caption text-ink-faint">
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
