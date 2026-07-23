import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTrip } from '../context/TripContext';
import { useToast } from '../context/ToastContext';
import { activityIcon } from '../lib/activities';
import { dayLabel, shortDate, todayIso } from '../lib/format';
import { recommendOutfit } from '../lib/packing';
import { Button, Card, Chip, ConfirmDialog, EmptyState, Field, Modal, SectionTitle, Spinner, TextArea, TextInput, Warning } from '../components/ui';
import { CommentThread, MemberDot, TripImage, WeatherBadge } from '../components/shared';
import { Icon } from '../components/Icon';
import { weatherLabel } from '../lib/weather';
import type { Outfit, TripMember } from '../lib/types';

/* ── Day list ── */

export function DaysPage() {
  const { activeTrip, loading, tripDays, weather, activities, themes, outfits, members } = useTrip();

  if (!activeTrip)
    return (
      <EmptyState
        icon="calendar"
        title="No trip selected"
        body="Daily plans appear once you create or open a trip."
        action={<Link to="/trips" className="text-sm font-semibold text-maroon underline underline-offset-2">Go to Trips →</Link>}
      />
    );
  if (loading) return <Spinner label="Loading daily plans" />;

  const today = todayIso();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-ink">Daily Plans</h1>
        <p className="text-sm text-ink-faint">
          {activeTrip.city} · {shortDate(activeTrip.start_date)} – {shortDate(activeTrip.end_date)}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {tripDays.map((d) => {
          const w = weather.find((x) => x.date === d);
          const dayActs = activities.filter((a) => a.date === d);
          const theme = themes.find((t) => t.date === d);
          const chosen = outfits.filter((o) => o.date === d && o.chosen);
          return (
            <Link key={d} to={`/days/${d}`} className="group">
              <Card className={`h-full transition-colors group-hover:border-maroon ${d === today ? '!border-maroon' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-ink">
                    {dayLabel(d)}
                    {d === today && <Chip className="ml-2 bg-maroon text-on-accent">Today</Chip>}
                  </p>
                  <WeatherBadge day={w} compact />
                </div>
                {theme && (
                  <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-maroon">
                    <Icon name="palette" size={15} /> {theme.name}
                  </p>
                )}
                {dayActs.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-1">
                    {dayActs.map((a) => (
                      <li key={a.id} className="flex items-center gap-2 text-sm text-ink-soft">
                        <span aria-hidden="true">{activityIcon(a.kind)}</span>
                        <span className="truncate">{a.name}</span>
                        {a.start_time && (
                          <span className="ml-auto shrink-0 text-xs tabular-nums text-ink-faint">
                            {a.start_time.slice(0, 5)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-ink-faint">Free day — no plans yet</p>
                )}
                <p className="mt-2 flex items-center gap-1 text-xs text-ink-faint">
                  <Icon name="shirt" size={13} /> {chosen.length}/{members.filter((m) => m.role !== 'viewer').length} outfits chosen
                </p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ── Day detail ── */

export function DayDetailPage() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const {
    activeTrip,
    loading,
    tripDays,
    weather,
    activities,
    themes,
    outfits,
    members,
    items,
    myMember,
    canContribute,
    votes,
    toggleVote,
    chooseOutfit,
    deleteOutfit,
    saveOutfit,
    postFeed,
  } = useTrip();
  const { toast } = useToast();
  const [outfitFor, setOutfitFor] = useState<TripMember | null>(null);
  const [editingOutfit, setEditingOutfit] = useState<Outfit | null>(null);
  const [confirmDeleteOutfit, setConfirmDeleteOutfit] = useState<Outfit | null>(null);

  if (!activeTrip || !date)
    return <EmptyState icon="calendar" title="No trip selected" body="Open a trip to see daily plans." />;
  if (loading) return <Spinner label="Loading the day" />;
  if (!tripDays.includes(date))
    return (
      <EmptyState
        icon="calendar-empty"
        title="That date isn't part of this trip"
        action={<Button variant="secondary" onClick={() => navigate('/days')}>Back to Daily Plans</Button>}
      />
    );

  const w = weather.find((x) => x.date === date);
  const dayActs = activities.filter((a) => a.date === date);
  const theme = themes.find((t) => t.date === date);
  const idx = tripDays.indexOf(date);
  const dayItems = items.filter(
    (i) => i.day === date || (i.activity_id && dayActs.some((a) => a.id === i.activity_id))
  );
  const outstanding = dayItems.filter(
    (i) => !i.packed || i.status === 'need' || i.status === 'considering'
  );
  const travelers = members.filter((m) => m.role !== 'viewer');

  return (
    <div className="flex flex-col gap-4">
      {/* Day header + prev/next */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" disabled={idx <= 0} onClick={() => navigate(`/days/${tripDays[idx - 1]}`)} aria-label="Previous day">
          <Icon name="chevron-right" size={20} className="rotate-180" />
        </Button>
        <div className="text-center">
          <h1 className="text-lg font-bold text-ink">{dayLabel(date)}</h1>
          <p className="text-xs text-ink-faint">
            Day {idx + 1} of {tripDays.length} · {activeTrip.city}
          </p>
        </div>
        <Button variant="ghost" disabled={idx >= tripDays.length - 1} onClick={() => navigate(`/days/${tripDays[idx + 1]}`)} aria-label="Next day">
          <Icon name="chevron-right" size={20} />
        </Button>
      </div>

      {/* Weather */}
      <Card>
        <SectionTitle>Weather</SectionTitle>
        {w && w.tMax != null ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <p className="text-3xl" aria-hidden="true">{weatherLabel(w.code).icon}</p>
            <div>
              <p className="text-lg font-bold tabular-nums text-ink">
                {Math.round(w.tMin ?? 0)}° – {Math.round(w.tMax)}°F
              </p>
              <p className="text-sm text-ink-faint">{weatherLabel(w.code).label}</p>
            </div>
            <div className="text-sm text-ink-soft">
              <p className="flex items-center gap-1"><Icon name="droplet" size={14} /> Rain: {w.precipProb != null ? `${Math.round(w.precipProb)}%` : '—'}</p>
              <p className="flex items-center gap-1"><Icon name="wind" size={14} /> Wind: {w.windMax != null ? `${Math.round(w.windMax)} mph` : '—'}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-faint">
            Forecast isn't available this far out yet — check back closer to the trip.
          </p>
        )}
      </Card>

      {/* Theme */}
      {theme && (
        <Card accent="rgb(var(--color-accent))">
          <SectionTitle action={<Chip className="bg-maroon-tint text-maroon">Group theme</Chip>}>
            <span className="inline-flex items-center gap-1.5"><Icon name="palette" size={18} /> {theme.name}</span>
          </SectionTitle>
          {theme.description && <p className="text-sm text-ink-soft">{theme.description}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {theme.colors && <Chip className="bg-cream text-ink-soft">Colors: {theme.colors}</Chip>}
            {theme.dress_code && <Chip className="bg-cream text-ink-soft">{theme.dress_code}</Chip>}
          </div>
          {theme.required_accessories && (
            <p className="mt-2 text-xs text-ink-faint">Accessories: {theme.required_accessories}</p>
          )}
        </Card>
      )}

      {/* Activities */}
      <Card>
        <SectionTitle>Activities</SectionTitle>
        {dayActs.length === 0 ? (
          <p className="text-sm text-ink-faint">Free day — nothing scheduled.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {dayActs.map((a) => (
              <li key={a.id} className="flex items-start gap-3">
                <span aria-hidden="true" className="text-xl">{activityIcon(a.kind)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{a.name}</p>
                  <p className="text-xs text-ink-faint">
                    {[
                      a.start_time && a.end_time
                        ? `${a.start_time.slice(0, 5)}–${a.end_time.slice(0, 5)}`
                        : a.start_time?.slice(0, 5),
                      a.location,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {a.dress_code && <Chip className="bg-maroon-tint text-maroon">{a.dress_code}</Chip>}
                    <Chip className="bg-cream text-ink-soft">{a.setting}</Chip>
                    {a.intensity === 'high' && <Chip className="bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">Very active</Chip>}
                    {a.equipment && <Chip className="bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300"><Icon name="bag" size={12} /> {a.equipment}</Chip>}
                  </div>
                  {a.notes && <p className="mt-1 text-xs text-ink-faint">{a.notes}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Still needed for this day */}
      {outstanding.length > 0 && (
        <Warning>
          <strong>{outstanding.length}</strong> item{outstanding.length > 1 ? 's' : ''} for this day
          still need{outstanding.length === 1 ? 's' : ''} to be packed or purchased:{' '}
          {outstanding.slice(0, 4).map((i) => i.name).join(', ')}
          {outstanding.length > 4 ? '…' : ''} —{' '}
          <Link to="/packing" className="font-semibold underline underline-offset-2">open Packing</Link>
        </Warning>
      )}

      {/* Outfits per traveler */}
      <SectionTitle>Outfits</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {travelers.map((m) => {
          const options = outfits.filter((o) => o.member_id === m.id && o.date === date);
          const rec = recommendOutfit({
            day: date,
            weather: w,
            activities: dayActs,
            theme,
            otherOutfits: outfits.filter((o) => o.member_id === m.id && o.date !== date && o.chosen),
          });
          const isMe = myMember?.id === m.id;
          return (
            <Card key={m.id} accent={m.color}>
              <div className="mb-2 flex items-center gap-2">
                <MemberDot member={m} />
                <p className="font-bold text-ink">{m.name}</p>
                {isMe && <Chip className="bg-cream text-ink-faint">you</Chip>}
              </div>

              {/* Recommendation */}
              <div className="rounded-xl bg-cream/70 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-maroon">What to wear</p>
                <p className="text-sm font-semibold text-ink">{rec.headline}</p>
                {rec.pieces.length > 0 && (
                  <p className="text-xs text-ink-soft">{rec.pieces.join(' · ')}</p>
                )}
                {rec.notes.map((n) => (
                  <p key={n} className="mt-0.5 text-[11px] text-ink-faint">• {n}</p>
                ))}
              </div>

              {/* Saved outfit options */}
              {options.length > 0 && (
                <ul className="mt-3 flex flex-col gap-2">
                  {options.map((o) => {
                    const voteCount = votes.filter(
                      (v) => v.target_kind === 'outfit' && v.target_id === o.id
                    ).length;
                    return (
                      <li key={o.id} className={`rounded-xl border p-3 ${o.chosen ? 'border-maroon bg-maroon-tint/40' : 'border-line bg-card'}`}>
                        <div className="flex items-start gap-3">
                          {(o.photo_path || o.external_image_url) && (
                            <TripImage
                              photo={{ storage_path: o.photo_path, external_url: o.external_image_url }}
                              alt={o.title || 'Outfit photo'}
                              className="h-16 w-14 shrink-0 rounded-lg"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-ink">
                              {o.title || 'Outfit option'}
                              {o.chosen && <Chip className="ml-1.5 bg-maroon text-on-accent">Wearing this</Chip>}
                              {o.approved && <Chip className="ml-1.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">Approved</Chip>}
                            </p>
                            <p className="text-xs text-ink-soft">
                              {[o.top_item, o.bottom_item, o.shoes, o.outerwear, o.accessories]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                            {o.notes && <p className="text-[11px] text-ink-faint">{o.notes}</p>}
                          </div>
                        </div>
                        {canContribute && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {!o.chosen && (
                              <Button variant="secondary" className="!min-h-[34px] px-2.5 text-xs" onClick={() => void chooseOutfit(o)}>
                                Wear this
                              </Button>
                            )}
                            <Button variant="ghost" className="!min-h-[34px] px-2.5 text-xs" onClick={() => void toggleVote('outfit', o.id)}>
                              <Icon name="thumbs-up" size={14} /> {voteCount > 0 ? voteCount : 'Vote'}
                            </Button>
                            {(isMe || canContribute) && (
                              <>
                                <Button variant="ghost" className="!min-h-[34px] px-2.5 text-xs" onClick={() => setEditingOutfit(o)}>
                                  Edit
                                </Button>
                                <Button variant="ghost" className="!min-h-[34px] px-2.5 text-xs text-rose-700 dark:text-rose-400" onClick={() => setConfirmDeleteOutfit(o)}>
                                  Delete
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                        <div className="mt-2">
                          <CommentThread kind="outfit" targetId={o.id} emptyText="" />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {canContribute && (
                <Button variant="secondary" className="mt-3 w-full !min-h-[38px] text-xs" onClick={() => setOutfitFor(m)}>
                  <Icon name="plus" size={16} /> Add outfit option for {m.name}
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      <OutfitFormModal
        open={outfitFor != null || editingOutfit != null}
        onClose={() => {
          setOutfitFor(null);
          setEditingOutfit(null);
        }}
        date={date}
        member={editingOutfit ? members.find((m) => m.id === editingOutfit.member_id) ?? null : outfitFor}
        outfit={editingOutfit}
        onSaved={() => {
          void postFeed('outfit', `updated an outfit for ${dayLabel(date)}`);
          toast('Outfit saved!', 'success');
        }}
        saveOutfit={saveOutfit}
        otherOutfits={outfits}
      />

      <ConfirmDialog
        open={confirmDeleteOutfit != null}
        onClose={() => setConfirmDeleteOutfit(null)}
        onConfirm={() => {
          if (confirmDeleteOutfit) void deleteOutfit(confirmDeleteOutfit.id);
        }}
        title="Delete this outfit option?"
        body="The photo, votes, and comments on it will be removed too."
      />
    </div>
  );
}

/* ── Outfit form ── */

function OutfitFormModal({
  open,
  onClose,
  date,
  member,
  outfit,
  onSaved,
  saveOutfit,
  otherOutfits,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  member: TripMember | null;
  outfit: Outfit | null;
  onSaved: () => void;
  saveOutfit: (o: Partial<Outfit> & { member_id: string; date: string }, photo?: File) => Promise<{ ok: boolean; error?: string }>;
  otherOutfits: Outfit[];
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState(outfit?.title ?? '');
  const [top, setTop] = useState(outfit?.top_item ?? '');
  const [bottom, setBottom] = useState(outfit?.bottom_item ?? '');
  const [shoes, setShoes] = useState(outfit?.shoes ?? '');
  const [outerwear, setOuterwear] = useState(outfit?.outerwear ?? '');
  const [accessories, setAccessories] = useState(outfit?.accessories ?? '');
  const [notes, setNotes] = useState(outfit?.notes ?? '');
  const [links, setLinks] = useState(outfit?.product_links ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [prevKey, setPrevKey] = useState('');

  // Re-sync form state when a different outfit/member opens the modal.
  const keyNow = `${outfit?.id ?? 'new'}-${member?.id ?? ''}-${open}`;
  if (open && keyNow !== prevKey) {
    setPrevKey(keyNow);
    setTitle(outfit?.title ?? '');
    setTop(outfit?.top_item ?? '');
    setBottom(outfit?.bottom_item ?? '');
    setShoes(outfit?.shoes ?? '');
    setOuterwear(outfit?.outerwear ?? '');
    setAccessories(outfit?.accessories ?? '');
    setNotes(outfit?.notes ?? '');
    setLinks(outfit?.product_links ?? '');
    setFile(null);
  }

  const dupePieces = useMemo(() => {
    if (!member) return [];
    const mine = otherOutfits.filter(
      (o) => o.member_id === member.id && o.date !== date && o.chosen && o.id !== outfit?.id
    );
    const worn = new Set(
      mine.flatMap((o) => [o.top_item, o.bottom_item, o.shoes].filter(Boolean) as string[])
    );
    return [top, bottom, shoes].filter((p) => p.trim() && worn.has(p.trim()));
  }, [member, otherOutfits, date, outfit, top, bottom, shoes]);

  if (!member) return null;

  const save = async () => {
    if (busy) return;
    setBusy(true);
    const res = await saveOutfit(
      {
        id: outfit?.id,
        member_id: member.id,
        date,
        title: title.trim(),
        top_item: top.trim() || null,
        bottom_item: bottom.trim() || null,
        shoes: shoes.trim() || null,
        outerwear: outerwear.trim() || null,
        accessories: accessories.trim() || null,
        notes: notes.trim() || null,
        product_links: links.trim() || null,
      },
      file ?? undefined
    );
    setBusy(false);
    if (res.ok) {
      onSaved();
      onClose();
    } else {
      toast(res.error ?? 'Could not save the outfit.', 'error');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`${outfit ? 'Edit' : 'New'} outfit — ${member.name}`} wide>
      <div className="flex flex-col gap-4">
        <Field label="Name this look">
          {(id) => <TextInput id={id} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Ocean Room formal" />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Top">{(id) => <TextInput id={id} value={top} onChange={(e) => setTop(e.target.value)} />}</Field>
          <Field label="Bottom">{(id) => <TextInput id={id} value={bottom} onChange={(e) => setBottom(e.target.value)} />}</Field>
          <Field label="Shoes">{(id) => <TextInput id={id} value={shoes} onChange={(e) => setShoes(e.target.value)} />}</Field>
          <Field label="Outerwear">{(id) => <TextInput id={id} value={outerwear} onChange={(e) => setOuterwear(e.target.value)} />}</Field>
        </div>
        <Field label="Accessories">
          {(id) => <TextInput id={id} value={accessories} onChange={(e) => setAccessories(e.target.value)} />}
        </Field>
        {dupePieces.length > 0 && (
          <Warning>
            Heads up — already planned for another day: <strong>{dupePieces.join(', ')}</strong>.
            Repeating on purpose is totally fine.
          </Warning>
        )}
        <Field label="Product links" hint="One per line — links to items in this look.">
          {(id) => <TextArea id={id} rows={2} value={links} onChange={(e) => setLinks(e.target.value)} />}
        </Field>
        <Field label="Photo" hint="Outfit photos are private to this trip's members.">
          {(id) => (
            <input
              id={id}
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm text-ink-soft file:mr-3 file:rounded-xl file:border-0 file:bg-maroon file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-on-accent"
            />
          )}
        </Field>
        <Field label="Notes">
          {(id) => <TextArea id={id} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={() => void save()} disabled={busy}>
            {busy ? 'Saving…' : 'Save outfit'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
