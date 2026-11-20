import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTrip } from '../context/TripContext';
import { useToast } from '../context/ToastContext';
import { computeReadiness } from '../lib/readiness';
import { daysUntil, percent, shortDate, timeAgo, todayIso, weekday } from '../lib/format';
import {
  Button,
  Card,
  EmptyState,
  ProgressBar,
  ReadinessRing,
  SectionTitle,
  Skeleton,
  SkeletonCard,
  SkeletonScreen,
  Warning,
} from '../components/ui';
import { MemberDot, WeatherBadge } from '../components/shared';
import { Icon, type IconName } from '../components/Icon';
import { ImportChatModal } from '../components/ImportChatModal';

const FEED_ICONS: Record<string, IconName> = {
  packed: 'check',
  comment: 'comment',
  photo: 'camera',
  outfit: 'shirt',
  purchase: 'cart',
  shipping: 'truck',
  theme: 'palette',
  member: 'users',
  update: 'sparkle',
};

export function HomePage() {
  const {
    trips,
    tripsLoading,
    activeTrip,
    loading,
    items,
    shipments,
    outfits,
    themes,
    activities,
    members,
    weather,
    feed,
    seedDemo,
    myMember,
  } = useTrip();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [seeding, setSeeding] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const readiness = useMemo(
    () =>
      activeTrip
        ? computeReadiness({ trip: activeTrip, items, shipments, outfits, themes, activities, members })
        : null,
    [activeTrip, items, shipments, outfits, themes, activities, members]
  );

  // Skeleton mirrors the real layout below (hero → promo → actions → two-up),
  // so nothing shifts when the data lands.
  if (tripsLoading)
    return (
      <SkeletonScreen label="Loading your trips">
        <div className="pb-8 pt-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="mt-3 h-12 w-36" />
          <Skeleton className="mt-3 h-4 w-28" />
        </div>
        <Card className="-mt-8">
          <div className="flex items-center gap-4">
            <Skeleton className="h-24 w-24 shrink-0 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-x-6 gap-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="mb-1.5 h-3 w-full" />
                <Skeleton className="h-2.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </Card>
        <Skeleton className="h-[76px] w-full rounded-lg" />
        <div className="grid gap-2 sm:grid-cols-2">
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </SkeletonScreen>
    );

  if (!activeTrip) {
    return (
      <div className="mx-auto max-w-lg">
        <EmptyState
          icon="compass"
          title="Plan a group trip"
          body="MockPacker turns your group trip into shared packing lists, daily outfit plans, shipment tracking, and a Trip Readiness score — so nothing gets left behind."
          action={
            <div className="flex flex-col gap-2">
              <Button onClick={() => navigate('/trips/new')}>Plan a Trip</Button>
              <Button
                variant="secondary"
                disabled={seeding}
                onClick={() => {
                  setSeeding(true);
                  void seedDemo().then((r) => {
                    setSeeding(false);
                    if (r.ok) toast('Demo trip loaded — explore away!', 'success');
                    else toast(r.error ?? 'Could not load the demo.', 'error');
                  });
                }}
              >
                {seeding ? 'Loading demo…' : 'Load a demo trip'}
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  const countdown = daysUntil(activeTrip.start_date);
  const departed = countdown != null && countdown < 0;
  const needItems = items.filter((i) => i.status === 'need' || i.status === 'considering');
  const unpackedRequired = items.filter((i) => i.required && !i.packed);
  const problemShipments = shipments.filter((s) => s.status === 'delayed' || s.status === 'exception');
  const undelivered = shipments.filter((s) => s.status !== 'delivered');
  const today = todayIso();
  const themeNeedingApproval = themes.find((t) => t.status !== 'approved');

  /* Suggested action cards, most urgent first. */
  const suggestions: { icon: IconName; text: string; to: string }[] = [];
  if (problemShipments.length > 0)
    suggestions.push({ icon: 'alert', text: 'Review a delayed shipment', to: '/shipments' });
  if (needItems.length > 0)
    suggestions.push({ icon: 'cart', text: `Order ${needItems.length} missing item${needItems.length > 1 ? 's' : ''}`, to: '/bag' });
  if (unpackedRequired.length > 0)
    suggestions.push({ icon: 'checklist', text: 'Finish your packing list', to: '/packing' });
  if (themeNeedingApproval)
    suggestions.push({ icon: 'palette', text: `Confirm the “${themeNeedingApproval.name}” theme`, to: '/group' });
  const keyDate = themes.find((t) => t.date)?.date;
  if (keyDate && !outfits.some((o) => o.member_id === myMember?.id && o.date === keyDate && o.chosen))
    suggestions.push({ icon: 'shirt', text: `Choose your ${weekday(keyDate)} outfit`, to: `/days/${keyDate}` });
  if (members.filter((m) => m.joined).length < members.length)
    suggestions.push({ icon: 'mail', text: 'Invite travelers who haven’t joined yet', to: '/group' });

  return (
    <div className="flex flex-col gap-4">
      {/* PLANE 2a — hero. One dominant element: the countdown numeral, set
          directly on the canvas (no surface). It drifts ~10px against the
          content as you scroll, and the readiness card below overlaps its
          bottom padding so the two read as separate layers. */}
      <header className="hero-glide pb-8 pt-2">
        <h1 className="truncate text-label text-ink-soft">
          {activeTrip.name}
          <span className="font-medium">
            {' · '}
            {[activeTrip.city, activeTrip.region].filter(Boolean).join(', ') || (departed ? 'In progress / past' : 'Upcoming trip')}
          </span>
        </h1>
        {!departed && countdown != null ? (
          <p className="mt-1 text-ink">
            <span className="text-display tabular-nums">{countdown === 0 ? 'Today' : countdown}</span>{' '}
            <span className="text-body font-semibold text-ink-soft">
              {countdown === 0 ? 'Departure day!' : `day${countdown === 1 ? '' : 's'} to go`}
            </span>
          </p>
        ) : (
          <p className="mt-1 line-clamp-2 text-display text-ink">{activeTrip.name}</p>
        )}
        <p className="mt-1 text-body text-ink-soft">
          {shortDate(activeTrip.start_date)} – {shortDate(activeTrip.end_date)}
        </p>
      </header>

      {/* PLANE 2b — content. Overlaps the hero's bottom padding. */}
      <Card className="relative z-content -mt-8">
        {readiness && (
          <div className="flex items-center gap-4">
            <ReadinessRing value={readiness.overall} />
            <div className="min-w-0">
              <p className="text-body font-bold text-ink">Trip Readiness</p>
              <p className="text-caption text-ink-soft">Across packing, shopping, shipping and more</p>
            </div>
          </div>
        )}
        {readiness && (
          <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-x-6 gap-y-3">
            {(
              [
                ['Packing', readiness.breakdown.packing],
                ['Shopping', readiness.breakdown.shopping],
                ['Shipping', readiness.breakdown.shipping],
                ['Documents', readiness.breakdown.documents],
                ['Outfits', readiness.breakdown.outfits],
                ['Activities', readiness.breakdown.activityPrep],
              ] as const
            ).map(([label, v]) => (
              <div key={label}>
                <div className="mb-1 flex flex-wrap justify-between gap-x-2 text-caption">
                  <span className="font-medium text-ink-soft">{label}</span>
                  <span className="tabular-nums text-ink-soft">{percent(v)}</span>
                </div>
                <ProgressBar value={v} label={`${label} progress`} />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Chat-import promo */}
      <button
        type="button"
        onClick={() => setImportOpen(true)}
        className="plane-content motion-safe-transform flex items-center gap-3 rounded-lg px-4 py-3.5 text-left transition-[transform] duration-press ease-press active:scale-[.98]"
      >
        <Icon name="sparkle" size={22} className="shrink-0 text-ink-soft" />
        <span className="min-w-0 flex-1">
          <span className="block text-body font-bold text-ink">New: start a trip from a group chat</span>
          <span className="block text-caption text-ink-soft">Paste the chat — we'll find the dates, spot &amp; crew</span>
        </span>
        <span className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-label text-on-accent">Try it</span>
      </button>
      <ImportChatModal open={importOpen} onClose={() => setImportOpen(false)} />

      {/* Alerts */}
      {readiness && readiness.alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {readiness.alerts.map((a, i) => (
            <Warning key={i} tone={a.tone}>
              {a.text}
            </Warning>
          ))}
        </div>
      )}

      {/* Suggested actions */}
      {suggestions.length > 0 && !loading && (
        <section aria-label="Suggested actions">
          <SectionTitle>Today's recommended actions</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            {suggestions.slice(0, 4).map((s) => (
              <Link
                key={s.text}
                to={s.to}
                className="plane-content motion-safe-transform flex min-h-[56px] items-center gap-3 rounded-lg px-4 transition-[transform] duration-press ease-press hover:border-accent active:scale-[.98]"
              >
                <Icon name={s.icon} size={22} className="text-accent" />
                <span className="text-body font-medium text-ink">{s.text}</span>
                <Icon name="chevron-right" size={18} className="ml-auto text-ink-faint" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Weather preview */}
        <Card>
          <SectionTitle
            action={
              <Link to="/days" className="inline-flex min-h-[44px] items-center text-label font-semibold text-accent underline underline-offset-2">
                Daily plans →
              </Link>
            }
          >
            Weather in {activeTrip.city || 'your destination'}
          </SectionTitle>
          {weather.length === 0 ? (
            <p className="text-body text-ink-faint">
              No forecast yet — add a destination city to the trip to see weather.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {weather.slice(0, 5).map((w) => (
                <li key={w.date} className="flex flex-wrap items-center justify-between gap-x-2">
                  <Link
                    to={`/days/${w.date}`}
                    className={`inline-flex min-h-[44px] items-center text-body text-accent underline-offset-2 hover:underline ${w.date === today ? 'font-bold' : 'font-medium'}`}
                  >
                    {weekday(w.date)} {shortDate(w.date).replace(/, \d{4}$/, '')}
                  </Link>
                  <WeatherBadge day={w} compact />
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Per-traveler packing */}
        <Card>
          <SectionTitle
            action={
              <Link to="/packing" className="inline-flex min-h-[44px] items-center text-label font-semibold text-accent underline underline-offset-2">
                Packing →
              </Link>
            }
          >
            Who's packed?
          </SectionTitle>
          {readiness && readiness.perTraveler.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {readiness.perTraveler.map(({ member, packed, total, pct }) => (
                <li key={member.id} className="flex items-center gap-3">
                  <MemberDot member={member} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap justify-between gap-x-2 text-caption">
                      <span className="text-label text-ink">
                        {member.name}
                        {!member.joined && member.role !== 'owner' && (
                          <span className="ml-1 text-ink-faint">(invited)</span>
                        )}
                      </span>
                      <span className="tabular-nums text-ink-faint">
                        {packed}/{total} · {percent(pct)}
                      </span>
                    </div>
                    <ProgressBar value={pct} color={member.color} label={`${member.name} packing progress`} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body text-ink-faint">Add travelers and packing items to see progress.</p>
          )}
        </Card>
      </div>

      {/* Shipments needing attention */}
      {undelivered.length > 0 && (
        <Card quiet>
          <SectionTitle
            action={
              <Link to="/shipments" className="inline-flex min-h-[44px] items-center text-label font-semibold text-accent underline underline-offset-2">
                All shipments →
              </Link>
            }
          >
            Deliveries on the way
          </SectionTitle>
          <p className="text-body text-ink-soft">
            {undelivered.length} shipment{undelivered.length > 1 ? 's' : ''} not delivered yet
            {problemShipments.length > 0 && (
              <span className="font-semibold text-danger">
                {' '}— {problemShipments.length} need{problemShipments.length === 1 ? 's' : ''} attention
              </span>
            )}
            .
          </p>
        </Card>
      )}

      {/* Recent group activity */}
      <Card quiet>
        <SectionTitle>Recent group activity</SectionTitle>
        {feed.length === 0 ? (
          <p className="text-body text-ink-faint">Activity from your travel group will show up here.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {feed.slice(0, 8).map((f) => (
              <li key={f.id} className="flex items-start gap-2.5 text-body">
                <Icon name={FEED_ICONS[f.kind] ?? 'sparkle'} size={18} className="mt-0.5 shrink-0 text-ink-faint" />
                <span className="min-w-0 flex-1 text-ink-soft">
                  <strong className="font-semibold text-ink">{f.actor_name}</strong> {f.message}
                </span>
                <span className="shrink-0 text-caption text-ink-faint">{timeAgo(f.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Other trips + CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {trips.length > 1 ? (
          <Link to="/trips" className="inline-flex min-h-[44px] items-center text-body font-semibold text-accent underline underline-offset-2">
            {trips.length - 1} other trip{trips.length > 2 ? 's' : ''} →
          </Link>
        ) : (
          <span />
        )}
        <Button onClick={() => navigate('/trips/new')}>Plan a Trip</Button>
      </div>
    </div>
  );
}
