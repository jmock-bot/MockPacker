import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTrip } from '../context/TripContext';
import { useToast } from '../context/ToastContext';
import { computeReadiness } from '../lib/readiness';
import { daysUntil, percent, shortDate, timeAgo, todayIso, weekday } from '../lib/format';
import { Button, Card, EmptyState, ProgressBar, ReadinessRing, SectionTitle, Spinner, Warning } from '../components/ui';
import { MemberDot, WeatherBadge } from '../components/shared';

const FEED_ICONS: Record<string, string> = {
  packed: '✅',
  comment: '💬',
  photo: '📷',
  outfit: '👗',
  purchase: '🛍️',
  shipping: '🚚',
  theme: '🎨',
  member: '👥',
  update: '✨',
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

  const readiness = useMemo(
    () =>
      activeTrip
        ? computeReadiness({ trip: activeTrip, items, shipments, outfits, themes, activities, members })
        : null,
    [activeTrip, items, shipments, outfits, themes, activities, members]
  );

  if (tripsLoading) return <Spinner label="Loading your trips" />;

  if (!activeTrip) {
    return (
      <div className="mx-auto max-w-lg">
        <EmptyState
          icon="🧳"
          title="No trips yet"
          body="Plan your first trip and MockPacker will build a personalized packing list, daily outfit plans, and a readiness dashboard for the whole group."
          action={
            <div className="flex flex-col gap-2">
              <Button onClick={() => navigate('/trips/new')}>✚ Plan a Trip</Button>
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
                {seeding ? 'Loading demo…' : '✨ Load a demo trip'}
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
  const suggestions: { icon: string; text: string; to: string }[] = [];
  if (problemShipments.length > 0)
    suggestions.push({ icon: '🚨', text: 'Review a delayed shipment', to: '/shipments' });
  if (needItems.length > 0)
    suggestions.push({ icon: '🛍️', text: `Order ${needItems.length} missing item${needItems.length > 1 ? 's' : ''}`, to: '/bag' });
  if (unpackedRequired.length > 0)
    suggestions.push({ icon: '✅', text: 'Finish your packing list', to: '/packing' });
  if (themeNeedingApproval)
    suggestions.push({ icon: '🎨', text: `Confirm the “${themeNeedingApproval.name}” theme`, to: '/group' });
  const keyDate = themes.find((t) => t.date)?.date;
  if (keyDate && !outfits.some((o) => o.member_id === myMember?.id && o.date === keyDate && o.chosen))
    suggestions.push({ icon: '👗', text: `Choose your ${weekday(keyDate)} outfit`, to: `/days/${keyDate}` });
  if (members.filter((m) => m.joined).length < members.length)
    suggestions.push({ icon: '✉️', text: 'Invite travelers who haven’t joined yet', to: '/group' });

  return (
    <div className="flex flex-col gap-4">
      {/* Hero: trip + countdown + readiness */}
      <Card className="!p-5" accent="rgb(var(--color-accent))">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-maroon">
              {departed ? 'In progress / past' : 'Upcoming trip'}
            </p>
            <h1 className="truncate text-xl font-bold text-ink">{activeTrip.name}</h1>
            <p className="text-sm text-ink-faint">
              {[activeTrip.city, activeTrip.region].filter(Boolean).join(', ')} ·{' '}
              {shortDate(activeTrip.start_date)} – {shortDate(activeTrip.end_date)}
            </p>
            {!departed && countdown != null && (
              <p className="mt-2 text-2xl font-bold tabular-nums text-maroon">
                {countdown === 0 ? 'Departure day! ✈️' : `${countdown} day${countdown === 1 ? '' : 's'} to go`}
              </p>
            )}
          </div>
          {readiness && (
            <div className="flex flex-col items-center gap-1">
              <ReadinessRing value={readiness.overall} />
              <p className="text-xs font-semibold text-ink-faint">Trip Readiness</p>
            </div>
          )}
        </div>
        {readiness && (
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
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
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium text-ink-soft">{label}</span>
                  <span className="tabular-nums text-ink-faint">{percent(v)}</span>
                </div>
                <ProgressBar value={v} label={`${label} progress`} />
              </div>
            ))}
          </div>
        )}
      </Card>

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
                className="flex min-h-[56px] items-center gap-3 rounded-card border border-line bg-card px-4 shadow-card transition-colors hover:border-maroon"
              >
                <span aria-hidden="true" className="text-xl">{s.icon}</span>
                <span className="text-sm font-medium text-ink">{s.text}</span>
                <span aria-hidden="true" className="ml-auto text-ink-faint">→</span>
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
              <Link to="/days" className="text-xs font-semibold text-maroon underline underline-offset-2">
                Daily plans →
              </Link>
            }
          >
            Weather in {activeTrip.city || 'your destination'}
          </SectionTitle>
          {weather.length === 0 ? (
            <p className="text-sm text-ink-faint">
              No forecast yet — add a destination city to the trip to see weather.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {weather.slice(0, 5).map((w) => (
                <li key={w.date} className="flex items-center justify-between gap-2">
                  <Link
                    to={`/days/${w.date}`}
                    className={`text-sm font-medium underline-offset-2 hover:underline ${w.date === today ? 'text-maroon' : 'text-ink-soft'}`}
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
              <Link to="/packing" className="text-xs font-semibold text-maroon underline underline-offset-2">
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
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium text-ink">
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
            <p className="text-sm text-ink-faint">Add travelers and packing items to see progress.</p>
          )}
        </Card>
      </div>

      {/* Shipments needing attention */}
      {undelivered.length > 0 && (
        <Card>
          <SectionTitle
            action={
              <Link to="/shipments" className="text-xs font-semibold text-maroon underline underline-offset-2">
                All shipments →
              </Link>
            }
          >
            Deliveries on the way
          </SectionTitle>
          <p className="text-sm text-ink-soft">
            {undelivered.length} shipment{undelivered.length > 1 ? 's' : ''} not delivered yet
            {problemShipments.length > 0 && (
              <span className="font-semibold text-rose-700 dark:text-rose-400">
                {' '}— {problemShipments.length} need{problemShipments.length === 1 ? 's' : ''} attention
              </span>
            )}
            .
          </p>
        </Card>
      )}

      {/* Recent group activity */}
      <Card>
        <SectionTitle>Recent group activity</SectionTitle>
        {feed.length === 0 ? (
          <p className="text-sm text-ink-faint">Activity from your travel group will show up here.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {feed.slice(0, 8).map((f) => (
              <li key={f.id} className="flex items-start gap-2.5 text-sm">
                <span aria-hidden="true">{FEED_ICONS[f.kind] ?? '✨'}</span>
                <span className="min-w-0 flex-1 text-ink-soft">
                  <strong className="font-semibold text-ink">{f.actor_name}</strong> {f.message}
                </span>
                <span className="shrink-0 text-[11px] text-ink-faint">{timeAgo(f.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Other trips + CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {trips.length > 1 ? (
          <Link to="/trips" className="text-sm font-semibold text-maroon underline underline-offset-2">
            {trips.length - 1} other trip{trips.length > 2 ? 's' : ''} →
          </Link>
        ) : (
          <span />
        )}
        <Button onClick={() => navigate('/trips/new')}>✚ Plan a Trip</Button>
      </div>
    </div>
  );
}
