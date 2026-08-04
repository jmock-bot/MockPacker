import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { AvatarStack, Button, EmptyState, Skeleton, SkeletonScreen } from '../components/ui';
import { MemberDot } from '../components/shared';
import { Icon } from '../components/Icon';

export function ChatPage() {
  const { activeTrip, loading, members, chatMessages, sendChatMessage, canContribute } = useTrip();
  const { session } = useAuth();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [chatMessages.length]);

  if (!activeTrip)
    return (
      <EmptyState
        icon="comment"
        title="No trip selected"
        body="Trip chat lives inside a trip — open one first."
        action={
          <Link to="/trips" className="text-sm font-semibold text-maroon underline underline-offset-2">
            Go to Trips →
          </Link>
        }
      />
    );
  // Alternating bubble widths/sides read as "a conversation is loading".
  if (loading)
    return (
      <SkeletonScreen label="Loading the chat">
        <div className="flex items-center gap-3">
          <Skeleton className="h-[30px] w-[30px] rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="mt-1.5 h-3 w-1/4" />
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-card border border-line bg-cream/60 p-3 dark:bg-cream/20">
          {[
            'mr-auto w-3/5',
            'ml-auto w-2/5',
            'mr-auto w-1/2',
            'ml-auto w-3/5',
            'mr-auto w-2/5',
          ].map((w, i) => (
            <Skeleton key={i} className={`h-12 rounded-card ${w}`} />
          ))}
        </div>
        <Skeleton className="h-11 w-full rounded-full" />
      </SkeletonScreen>
    );

  const submit = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    const r = await sendChatMessage(body);
    setBusy(false);
    if (r.ok) setDraft('');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <AvatarStack people={members.map((m) => ({ name: m.name, color: m.color }))} max={4} size={30} />
        <div className="min-w-0">
          <h1 className="truncate text-title text-ink">{activeTrip.name} chat</h1>
          <p className="text-caption text-ink-faint">
            {members.length} traveler{members.length === 1 ? '' : 's'} · trip chat
          </p>
        </div>
      </div>

      <div className="flex max-h-[65vh] flex-col gap-2.5 overflow-y-auto rounded-card border border-line bg-cream/60 p-3 dark:bg-cream/20">
        {chatMessages.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-faint">No messages yet — say hi to the group.</p>
        ) : (
          chatMessages.map((m) => {
            if (m.kind === 'system')
              return (
                <div
                  key={m.id}
                  className="mx-auto max-w-[85%] rounded-full bg-maroon-tint px-3 py-1.5 text-center text-xs font-semibold text-maroon"
                >
                  {m.body}
                </div>
              );

            const mine = m.author_id != null && m.author_id === session?.user.id;
            if (mine)
              return (
                <div
                  key={m.id}
                  className="ml-auto max-w-[78%] rounded-lg rounded-br-sm bg-maroon px-3 py-2 text-sm leading-relaxed text-on-accent"
                >
                  {m.body}
                </div>
              );

            const member = members.find((mm) => mm.user_id === m.author_id);
            return (
              <div key={m.id} className="flex max-w-[82%] items-end gap-1.5">
                {member ? (
                  <MemberDot member={member} size={22} />
                ) : (
                  // Decorative: the author's full name is rendered beside it,
                  // so the initials are redundant to a screen reader. Hidden
                  // rather than enlarged — 12px would not fit a 22px circle.
                  <span
                    aria-hidden="true"
                    className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-line text-[9px] font-bold text-ink-soft"
                  >
                    {m.author_name.slice(0, 2).toUpperCase() || '?'}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="mb-0.5 ml-0.5 text-caption font-semibold text-ink-soft">{m.author_name}</p>
                  <div className="rounded-lg rounded-bl-sm border border-line bg-card px-3 py-2 text-sm leading-relaxed text-ink">
                    {m.body}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {canContribute ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message the group"
            aria-label="Message the group"
            className="min-h-[44px] w-full rounded-full border border-line-control bg-cream px-4 text-base text-ink placeholder:text-ink-soft focus:border-maroon focus:outline-none focus:ring-2 focus:ring-maroon/15"
          />
          <Button
            type="submit"
            loading={busy} disabled={!draft.trim()}
            aria-label="Send message"
            className="h-11 w-11 shrink-0 !min-h-0 !rounded-full !px-0"
          >
            <Icon name="send" size={18} />
          </Button>
        </form>
      ) : (
        <p className="text-center text-xs text-ink-faint">Viewers can read the chat but can't post.</p>
      )}
    </div>
  );
}
