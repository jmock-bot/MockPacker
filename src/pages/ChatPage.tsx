import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { Button, EmptyState, Spinner } from '../components/ui';
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
  if (loading) return <Spinner label="Loading the chat" />;

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
        <div className="flex shrink-0">
          {members.slice(0, 5).map((m) => (
            <span key={m.id} className="-ml-2 rounded-full ring-2 ring-paper first:ml-0">
              <MemberDot member={m} size={30} />
            </span>
          ))}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold text-ink">{activeTrip.name} chat</h1>
          <p className="text-xs text-ink-faint">
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
                  className="ml-auto max-w-[78%] rounded-2xl rounded-br-md bg-maroon px-3 py-2 text-sm leading-relaxed text-on-accent"
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
                  <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-line text-[9px] font-bold text-ink-soft">
                    {m.author_name.slice(0, 2).toUpperCase() || '?'}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="mb-0.5 ml-0.5 text-[10px] font-semibold text-ink-soft">{m.author_name}</p>
                  <div className="rounded-2xl rounded-bl-md border border-line bg-card px-3 py-2 text-sm leading-relaxed text-ink">
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
            className="min-h-[44px] w-full rounded-full border border-line bg-cream px-4 text-base text-ink placeholder:text-ink-faint focus:border-maroon focus:outline-none focus:ring-2 focus:ring-maroon/15"
          />
          <Button
            type="submit"
            disabled={busy || !draft.trim()}
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
