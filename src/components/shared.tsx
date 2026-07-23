import { useEffect, useState, type ReactNode } from 'react';
import { signedPhotoUrl } from '../lib/supabase';
import { weatherLabel } from '../lib/weather';
import { timeAgo } from '../lib/format';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { Button, TextInput } from './ui';
import type { CommentRow, Photo, TripMember, WeatherDay } from '../lib/types';

/* ---------- Member avatar chip ---------- */

export function MemberDot({ member, size = 28 }: { member: TripMember; size?: number }) {
  const initials = member.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, backgroundColor: member.color, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  );
}

export function MemberChip({ member }: { member: TripMember }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-cream px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
      <span
        aria-hidden="true"
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: member.color }}
      />
      {member.name}
    </span>
  );
}

/* ---------- Trip photo (private bucket → signed URL, or external) ---------- */

export function TripImage({
  photo,
  alt,
  className = '',
}: {
  photo: { storage_path?: string | null; external_url?: string | null };
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(photo.external_url ?? null);
  const path = photo.storage_path ?? null;

  useEffect(() => {
    let cancelled = false;
    if (photo.external_url) {
      setUrl(photo.external_url);
      return;
    }
    if (!path) return;
    void signedPhotoUrl(path).then((signed) => {
      if (!cancelled) setUrl(signed);
    });
    return () => {
      cancelled = true;
    };
  }, [path, photo.external_url]);

  if (!url)
    return (
      <div
        aria-hidden="true"
        className={`flex items-center justify-center bg-cream text-2xl text-ink-faint ${className}`}
      >
        🖼️
      </div>
    );
  return <img src={url} alt={alt} loading="lazy" className={`object-cover ${className}`} />;
}

/* ---------- Weather badge ---------- */

export function WeatherBadge({ day, compact }: { day: WeatherDay | undefined; compact?: boolean }) {
  if (!day) return null;
  const { label, icon } = weatherLabel(day.code);
  if (day.tMax == null)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-ink-faint">
        <span aria-hidden="true">🗓️</span> Forecast soon
      </span>
    );
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-soft">
      <span aria-hidden="true" className="text-base">{icon}</span>
      <span className="font-semibold tabular-nums">
        {Math.round(day.tMin ?? 0)}–{Math.round(day.tMax)}°F
      </span>
      {!compact && <span>{label}</span>}
      {(day.precipProb ?? 0) >= 30 && (
        <span className="font-medium text-sky-700 dark:text-sky-400">💧 {Math.round(day.precipProb ?? 0)}%</span>
      )}
      {(day.windMax ?? 0) >= 20 && <span className="font-medium">💨 {Math.round(day.windMax ?? 0)} mph</span>}
    </span>
  );
}

/* ---------- Comments + reactions thread ---------- */

export function CommentThread({
  kind,
  targetId,
  emptyText = 'No comments yet — start the conversation.',
}: {
  kind: CommentRow['target_kind'];
  targetId: string;
  emptyText?: string;
}) {
  const { comments, reactions, addComment, deleteComment, toggleReaction, canContribute } = useTrip();
  const { session } = useAuth();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const thread = comments.filter((c) => c.target_kind === kind && c.target_id === targetId);
  const reactionKind = kind === 'photo' ? 'photo' : kind === 'theme' ? 'theme' : 'outfit';
  const targetReactions = reactions.filter(
    (r) => r.target_kind === reactionKind && r.target_id === targetId
  );

  const submit = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    await addComment(kind, targetId, body);
    setDraft('');
    setBusy(false);
  };

  const emojis = ['❤️', '🔥', '😂', '👍'];

  return (
    <div className="flex flex-col gap-2">
      {kind !== 'trip' && (
        <div className="flex flex-wrap gap-1">
          {emojis.map((e) => {
            const count = targetReactions.filter((r) => r.emoji === e).length;
            const mine = targetReactions.some(
              (r) => r.emoji === e && r.user_id === session?.user.id
            );
            return (
              <button
                key={e}
                type="button"
                disabled={!canContribute}
                onClick={() => void toggleReaction(reactionKind, targetId, e)}
                aria-pressed={mine}
                aria-label={`React ${e}${count ? `, ${count}` : ''}`}
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  mine ? 'border-maroon bg-maroon-tint' : 'border-line bg-card'
                } disabled:opacity-50`}
              >
                {e} {count > 0 && <span className="font-semibold tabular-nums">{count}</span>}
              </button>
            );
          })}
        </div>
      )}

      {thread.length === 0 ? (
        <p className="text-xs text-ink-faint">{emptyText}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {thread.map((c) => (
            <li key={c.id} className="rounded-xl bg-cream/70 px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-bold text-ink">{c.author_name}</p>
                <span className="flex items-center gap-2 text-[10px] text-ink-faint">
                  {timeAgo(c.created_at)}
                  {c.author_id === session?.user.id && (
                    <button
                      type="button"
                      onClick={() => void deleteComment(c.id)}
                      className="font-semibold underline underline-offset-2"
                    >
                      Delete
                    </button>
                  )}
                </span>
              </div>
              <p className="text-sm text-ink-soft">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      {canContribute && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <TextInput
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a comment…"
            aria-label="Add a comment"
          />
          <Button type="submit" disabled={busy || !draft.trim()} className="shrink-0 px-3">
            Post
          </Button>
        </form>
      )}
    </div>
  );
}

/* ---------- Photo card with thread ---------- */

export function PhotoCard({ photo, actions }: { photo: Photo; actions?: ReactNode }) {
  const { members } = useTrip();
  const member = members.find((m) => m.id === photo.member_id);
  return (
    <div className="overflow-hidden rounded-card border border-line bg-card shadow-card">
      <TripImage photo={photo} alt={photo.caption ?? 'Trip photo'} className="aspect-[4/3] w-full" />
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            {photo.caption && <p className="text-sm font-medium text-ink">{photo.caption}</p>}
            <p className="text-[11px] text-ink-faint">
              {photo.uploader_name}
              {member ? ` · for ${member.name}` : ''} · {timeAgo(photo.created_at)}
            </p>
          </div>
          {actions}
        </div>
        <CommentThread kind="photo" targetId={photo.id} />
      </div>
    </div>
  );
}
