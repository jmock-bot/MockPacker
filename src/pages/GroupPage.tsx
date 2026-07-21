import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTrip } from '../context/TripContext';
import { useToast } from '../context/ToastContext';
import { ROLE_META, THEME_STATUS_META } from '../lib/statuses';
import { dayLabel, timeAgo } from '../lib/format';
import { Button, Card, Chip, ConfirmDialog, EmptyState, Field, Modal, SectionTitle, Select, Spinner, TextArea, TextInput } from '../components/ui';
import { MemberDot, PhotoCard, CommentThread, TripImage } from '../components/shared';
import type { Photo, Theme, TripMember, TripRole } from '../lib/types';

const THEME_IDEAS = [
  'Matching colors',
  'Formal night',
  'All-white event',
  'Western night',
  'Resort wear',
  'Team colors',
  'Family photo outfits',
  'Decade theme',
];

const PHOTO_KINDS = [
  ['inspiration', 'Outfit inspiration'],
  ['owned', 'Clothing I own'],
  ['product', 'Product screenshot'],
  ['theme', 'Group theme'],
  ['luggage', 'Luggage'],
  ['packed', 'Packed items'],
  ['memory', 'Trip memory'],
] as const;

export function GroupPage() {
  const {
    activeTrip,
    loading,
    members,
    themes,
    votes,
    photos,
    outfits,
    feed,
    myRole,
    canOrganize,
    canContribute,
    inviteMember,
    updateMember,
    removeMember,
    saveTheme,
    deleteTheme,
    toggleVote,
    addPhoto,
    deletePhoto,
    postFeed,
  } = useTrip();
  const { session } = useAuth();
  const { toast } = useToast();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TripRole>('traveler');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<TripMember | null>(null);

  const [themeOpen, setThemeOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
  const [deleteThemeTarget, setDeleteThemeTarget] = useState<Theme | null>(null);

  const [photoOpen, setPhotoOpen] = useState(false);
  const [deletePhotoTarget, setDeletePhotoTarget] = useState<Photo | null>(null);

  if (!activeTrip)
    return (
      <EmptyState
        icon="👥"
        title="No trip selected"
        body="Group tools live inside a trip."
        action={<Link to="/trips" className="text-sm font-semibold text-maroon underline underline-offset-2">Go to Trips →</Link>}
      />
    );
  if (loading) return <Spinner label="Loading the group" />;

  const invite = async () => {
    if (!inviteName.trim()) return;
    const res = await inviteMember(inviteName.trim(), inviteEmail.trim() || null, inviteRole);
    if (res.ok && res.code) {
      const link = `${window.location.origin}/join/${res.code}`;
      setInviteLink(link);
      toast('Invitation created!', 'success');
    } else {
      toast(res.error ?? 'Could not create the invitation.', 'error');
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied to clipboard.', 'success');
    } catch {
      toast('Could not copy — long-press the link instead.', 'warning');
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ── Travelers ── */}
      <section aria-label="Travelers">
        <SectionTitle
          action={
            canOrganize && (
              <Button className="!min-h-[38px] px-3 text-xs" onClick={() => { setInviteOpen(true); setInviteLink(null); }}>
                ✚ Invite
              </Button>
            )
          }
        >
          Travelers ({members.length})
        </SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2">
          {members.map((m) => {
            const isSelf = m.user_id === session?.user.id;
            return (
              <Card key={m.id} className="flex items-center gap-3 !p-3">
                <MemberDot member={m} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {m.name} {isSelf && <span className="text-xs font-normal text-ink-faint">(you)</span>}
                  </p>
                  <p className="text-xs text-ink-faint">
                    {ROLE_META[m.role].label}
                    {!m.joined && m.role !== 'owner' && ' · invited, not joined yet'}
                  </p>
                </div>
                {canOrganize && m.role !== 'owner' && (
                  <div className="flex shrink-0 items-center gap-1">
                    {!m.joined && (
                      <Button
                        variant="ghost"
                        className="!min-h-[34px] px-2 text-xs"
                        onClick={() => void copy(`${window.location.origin}/join/${m.invite_code}`)}
                      >
                        Copy link
                      </Button>
                    )}
                    <Select
                      value={m.role}
                      onChange={(e) => void updateMember(m.id, { role: e.target.value as TripRole })}
                      aria-label={`${m.name} role`}
                      className="!min-h-[34px] max-w-[110px] !text-xs"
                    >
                      <option value="organizer">Organizer</option>
                      <option value="traveler">Traveler</option>
                      <option value="viewer">Viewer</option>
                    </Select>
                    <button
                      type="button"
                      onClick={() => setRemoveTarget(m)}
                      aria-label={`Remove ${m.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint hover:bg-black/5"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
        {myRole && (
          <p className="mt-2 text-xs text-ink-faint">
            Your role: <strong>{ROLE_META[myRole].label}</strong> — {ROLE_META[myRole].blurb}.
          </p>
        )}
      </section>

      {/* ── Themed days ── */}
      <section aria-label="Themed days">
        <SectionTitle
          action={
            canContribute && (
              <Button className="!min-h-[38px] px-3 text-xs" onClick={() => { setEditingTheme(null); setThemeOpen(true); }}>
                ✚ New theme
              </Button>
            )
          }
        >
          Themed days
        </SectionTitle>
        {themes.length === 0 ? (
          <EmptyState
            icon="🎨"
            title="No themes yet"
            body="Coordinate the group — formal night, all-white photos, western night, team colors…"
          />
        ) : (
          <div className="flex flex-col gap-3">
            {themes.map((t) => {
              const voteCount = votes.filter((v) => v.target_kind === 'theme' && v.target_id === t.id).length;
              const iVoted = votes.some(
                (v) => v.target_kind === 'theme' && v.target_id === t.id && v.user_id === session?.user.id
              );
              const boardOutfits = t.date
                ? outfits.filter((o) => o.date === t.date && o.chosen)
                : [];
              return (
                <Card key={t.id} accent="#6e1423">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-ink">🎨 {t.name}</p>
                      <p className="text-xs text-ink-faint">
                        {t.date ? dayLabel(t.date) : 'Date TBD'}
                        {t.colors && <> · Palette: {t.colors}</>}
                      </p>
                    </div>
                    <Chip className={THEME_STATUS_META[t.status].chip}>{THEME_STATUS_META[t.status].label}</Chip>
                  </div>
                  {t.description && <p className="mt-1 text-sm text-ink-soft">{t.description}</p>}
                  {(t.suggested_clothing || t.required_accessories) && (
                    <p className="mt-1 text-xs text-ink-faint">
                      {t.suggested_clothing && <>Wear: {t.suggested_clothing}. </>}
                      {t.required_accessories && <>Accessories: {t.required_accessories}.</>}
                    </p>
                  )}

                  {/* Coordination board */}
                  {boardOutfits.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-faint">
                        Coordination board
                      </p>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {members
                          .filter((m) => m.role !== 'viewer')
                          .map((m) => {
                            const o = boardOutfits.find((x) => x.member_id === m.id);
                            return (
                              <div key={m.id} className="w-28 shrink-0 rounded-xl border border-line bg-white p-2 text-center">
                                <MemberDot member={m} size={24} />
                                <p className="mt-1 truncate text-[11px] font-semibold text-ink">{m.name}</p>
                                {o ? (
                                  <>
                                    {(o.photo_path || o.external_image_url) && (
                                      <TripImage
                                        photo={{ storage_path: o.photo_path, external_url: o.external_image_url }}
                                        alt={`${m.name}'s outfit`}
                                        className="mt-1 h-20 w-full rounded-lg"
                                      />
                                    )}
                                    <p className="mt-1 line-clamp-2 text-[10px] text-ink-soft">
                                      {o.title || [o.top_item, o.bottom_item].filter(Boolean).join(', ')}
                                    </p>
                                  </>
                                ) : (
                                  <p className="mt-2 text-[10px] text-ink-faint">No outfit yet</p>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {canContribute && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Button variant="secondary" className="!min-h-[34px] px-2.5 text-xs" onClick={() => void toggleVote('theme', t.id)}>
                        {iVoted ? '✓ Voted' : '🗳️ Vote'} {voteCount > 0 && `(${voteCount})`}
                      </Button>
                      {canOrganize && t.status !== 'approved' && (
                        <Button
                          variant="success"
                          className="!min-h-[34px] px-2.5 text-xs"
                          onClick={() => {
                            void saveTheme({ id: t.id, name: t.name, status: 'approved' }).then(() => {
                              void postFeed('theme', `approved the ${t.name} theme`);
                              toast('Theme approved! 🎉', 'success');
                            });
                          }}
                        >
                          Approve
                        </Button>
                      )}
                      <Button variant="ghost" className="!min-h-[34px] px-2.5 text-xs" onClick={() => { setEditingTheme(t); setThemeOpen(true); }}>
                        Edit
                      </Button>
                      {canOrganize && (
                        <Button variant="ghost" className="!min-h-[34px] px-2.5 text-xs text-rose-700" onClick={() => setDeleteThemeTarget(t)}>
                          Delete
                        </Button>
                      )}
                      {t.date && (
                        <Link to={`/days/${t.date}`} className="ml-auto self-center text-xs font-semibold text-maroon underline underline-offset-2">
                          Plan outfits →
                        </Link>
                      )}
                    </div>
                  )}
                  <div className="mt-3">
                    <CommentThread kind="theme" targetId={t.id} emptyText="Discuss the theme here." />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Photos ── */}
      <section aria-label="Photos">
        <SectionTitle
          action={
            canContribute && (
              <Button className="!min-h-[38px] px-3 text-xs" onClick={() => setPhotoOpen(true)}>
                ✚ Upload photo
              </Button>
            )
          }
        >
          Photos
        </SectionTitle>
        <p className="-mt-2 mb-2 text-xs text-ink-faint">
          🔒 Photos are stored privately and only visible to people on this trip.
        </p>
        {photos.length === 0 ? (
          <EmptyState icon="📷" title="No photos yet" body="Share outfit ideas, product screenshots, or packing progress." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {photos.map((p) => (
              <PhotoCard
                key={p.id}
                photo={p}
                actions={
                  (p.uploaded_by === session?.user.id || canOrganize) && (
                    <button
                      type="button"
                      onClick={() => setDeletePhotoTarget(p)}
                      aria-label="Delete photo"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-faint hover:bg-black/5"
                    >
                      🗑️
                    </button>
                  )
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Recent activity ── */}
      <section aria-label="Recent activity">
        <SectionTitle>Recent activity</SectionTitle>
        <Card>
          {feed.length === 0 ? (
            <p className="text-sm text-ink-faint">Group updates will appear here.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {feed.slice(0, 15).map((f) => (
                <li key={f.id} className="flex items-start gap-2 text-sm text-ink-soft">
                  <span className="min-w-0 flex-1">
                    <strong className="font-semibold text-ink">{f.actor_name}</strong> {f.message}
                  </span>
                  <span className="shrink-0 text-[11px] text-ink-faint">{timeAgo(f.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* ── Invite modal ── */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite a traveler">
        {inviteLink ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-soft">
              Share this link with <strong>{inviteName}</strong> — opening it (after signing in)
              joins them to the trip:
            </p>
            <code className="break-all rounded-xl bg-cream p-3 text-xs text-ink">{inviteLink}</code>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => void copy(inviteLink)}>
                Copy link
              </Button>
              {inviteEmail.trim() && (
                <a
                  className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink"
                  href={`mailto:${encodeURIComponent(inviteEmail)}?subject=${encodeURIComponent(`Join our trip: ${activeTrip.name}`)}&body=${encodeURIComponent(`You're invited to ${activeTrip.name} on MockPacker!\n\nJoin here: ${inviteLink}`)}`}
                >
                  ✉️ Email it
                </a>
              )}
            </div>
            <div className="text-center">
              <p className="mb-2 text-xs text-ink-faint">Or scan to join:</p>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(inviteLink)}`}
                alt={`QR code for the invitation link for ${inviteName}`}
                width={180}
                height={180}
                className="mx-auto rounded-xl border border-line"
              />
            </div>
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>Done</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Field label="Name" required>
              {(id) => <TextInput id={id} value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Jordan" />}
            </Field>
            <Field label="Email (optional)">
              {(id) => <TextInput id={id} type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="jordan@example.com" />}
            </Field>
            <Field label="Role" hint={ROLE_META[inviteRole].blurb}>
              {(id) => (
                <Select id={id} value={inviteRole} onChange={(e) => setInviteRole(e.target.value as TripRole)}>
                  <option value="organizer">Organizer</option>
                  <option value="traveler">Traveler</option>
                  <option value="viewer">Viewer</option>
                </Select>
              )}
            </Field>
            <Button onClick={() => void invite()} disabled={!inviteName.trim()}>
              Create invitation
            </Button>
          </div>
        )}
      </Modal>

      {/* ── Theme modal ── */}
      <ThemeFormModal
        open={themeOpen}
        onClose={() => setThemeOpen(false)}
        theme={editingTheme}
        onSaved={() => toast('Theme saved! 🎨', 'success')}
      />

      {/* ── Photo modal ── */}
      <PhotoUploadModal open={photoOpen} onClose={() => setPhotoOpen(false)} addPhoto={addPhoto} />

      <ConfirmDialog
        open={removeTarget != null}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) void removeMember(removeTarget.id);
        }}
        title={`Remove ${removeTarget?.name ?? ''} from the trip?`}
        body="Their assigned items become shared items. They will lose access to this trip."
        confirmLabel="Remove traveler"
      />
      <ConfirmDialog
        open={deleteThemeTarget != null}
        onClose={() => setDeleteThemeTarget(null)}
        onConfirm={() => {
          if (deleteThemeTarget) void deleteTheme(deleteThemeTarget.id);
        }}
        title={`Delete the “${deleteThemeTarget?.name ?? ''}” theme?`}
        body="Votes and comments on it will be removed."
      />
      <ConfirmDialog
        open={deletePhotoTarget != null}
        onClose={() => setDeletePhotoTarget(null)}
        onConfirm={() => {
          if (deletePhotoTarget) void deletePhoto(deletePhotoTarget.id);
        }}
        title="Delete this photo?"
        body="The photo and its comments will be permanently removed."
      />
    </div>
  );
}

/* ── Theme form ── */

function ThemeFormModal({
  open,
  onClose,
  theme,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  theme: Theme | null;
  onSaved: () => void;
}) {
  const { tripDays, saveTheme } = useTrip();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [colors, setColors] = useState('');
  const [dressCode, setDressCode] = useState('');
  const [clothing, setClothing] = useState('');
  const [accessories, setAccessories] = useState('');
  const [status, setStatus] = useState<Theme['status']>('proposed');
  const [busy, setBusy] = useState(false);
  const [prevKey, setPrevKey] = useState('');

  const keyNow = `${theme?.id ?? 'new'}-${open}`;
  if (open && keyNow !== prevKey) {
    setPrevKey(keyNow);
    setName(theme?.name ?? '');
    setDate(theme?.date ?? '');
    setDescription(theme?.description ?? '');
    setColors(theme?.colors ?? '');
    setDressCode(theme?.dress_code ?? '');
    setClothing(theme?.suggested_clothing ?? '');
    setAccessories(theme?.required_accessories ?? '');
    setStatus(theme?.status ?? 'proposed');
  }

  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    const res = await saveTheme({
      id: theme?.id,
      name: name.trim(),
      date: date || null,
      description: description.trim() || null,
      colors: colors.trim() || null,
      dress_code: dressCode.trim() || null,
      suggested_clothing: clothing.trim() || null,
      required_accessories: accessories.trim() || null,
      status,
    });
    setBusy(false);
    if (res.ok) {
      onSaved();
      onClose();
    } else {
      toast(res.error ?? 'Could not save the theme.', 'error');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={theme ? 'Edit theme' : 'New themed day'} wide>
      <div className="flex flex-col gap-4">
        <Field label="Theme name" required>
          {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="All-White Beach Photos" />}
        </Field>
        {!theme && (
          <div className="flex flex-wrap gap-1.5">
            {THEME_IDEAS.map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => setName(idea)}
                className="rounded-full border border-line bg-white px-2.5 py-1 text-xs text-ink-soft hover:border-maroon hover:text-maroon"
              >
                {idea}
              </button>
            ))}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date">
            {(id) => (
              <Select id={id} value={date} onChange={(e) => setDate(e.target.value)}>
                <option value="">Pick a day…</option>
                {tripDays.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Status">
            {(id) => (
              <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as Theme['status'])}>
                <option value="proposed">Proposed</option>
                <option value="voting">Voting</option>
                <option value="approved">Approved</option>
              </Select>
            )}
          </Field>
        </div>
        <Field label="Description">
          {(id) => <TextArea id={id} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Color palette" hint="e.g. white, cream, tan">
            {(id) => <TextInput id={id} value={colors} onChange={(e) => setColors(e.target.value)} />}
          </Field>
          <Field label="Dress code">
            {(id) => <TextInput id={id} value={dressCode} onChange={(e) => setDressCode(e.target.value)} />}
          </Field>
          <Field label="Suggested clothing">
            {(id) => <TextInput id={id} value={clothing} onChange={(e) => setClothing(e.target.value)} />}
          </Field>
          <Field label="Required accessories">
            {(id) => <TextInput id={id} value={accessories} onChange={(e) => setAccessories(e.target.value)} />}
          </Field>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button className="flex-1" onClick={() => void save()} disabled={busy || !name.trim()}>
            {busy ? 'Saving…' : 'Save theme'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ── Photo upload ── */

function PhotoUploadModal({
  open,
  onClose,
  addPhoto,
}: {
  open: boolean;
  onClose: () => void;
  addPhoto: (meta: Partial<Photo> & { kind: string }, file?: File) => Promise<{ ok: boolean; error?: string }>;
}) {
  const { members, tripDays } = useTrip();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [kind, setKind] = useState<string>('inspiration');
  const [memberId, setMemberId] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!file || busy) return;
    setBusy(true);
    const res = await addPhoto(
      {
        kind,
        caption: caption.trim() || null,
        member_id: memberId || null,
        date: date || null,
      },
      file
    );
    setBusy(false);
    if (res.ok) {
      toast('Photo uploaded! 📷', 'success');
      setFile(null);
      setCaption('');
      onClose();
    } else {
      toast(res.error ?? 'Upload failed.', 'error');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Upload a photo">
      <div className="flex flex-col gap-4">
        <Field label="Photo" required hint="Stored securely — only trip members can see it.">
          {(id) => (
            <input
              id={id}
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm text-ink-soft file:mr-3 file:rounded-xl file:border-0 file:bg-maroon file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white"
            />
          )}
        </Field>
        <Field label="What is it?">
          {(id) => (
            <Select id={id} value={kind} onChange={(e) => setKind(e.target.value)}>
              {PHOTO_KINDS.map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Caption">
          {(id) => <TextInput id={id} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Thoughts on this for photo day?" />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="For traveler">
            {(id) => (
              <Select id={id} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                <option value="">—</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Trip day">
            {(id) => (
              <Select id={id} value={date} onChange={(e) => setDate(e.target.value)}>
                <option value="">—</option>
                {tripDays.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button className="flex-1" onClick={() => void save()} disabled={busy || !file}>
            {busy ? 'Uploading…' : 'Upload'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
