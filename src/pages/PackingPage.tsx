import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTrip } from '../context/TripContext';
import { useToast } from '../context/ToastContext';
import { BAG_STATUS_META, PACKING_CATEGORIES } from '../lib/statuses';
import { percent, shortDate } from '../lib/format';
import { Button, Card, Chip, ConfirmDialog, EmptyState, ProgressBar, Select, Spinner } from '../components/ui';
import { ItemFormModal } from '../components/ItemFormModal';
import { MemberChip } from '../components/shared';
import type { PackingItem } from '../lib/types';

export function PackingPage() {
  const { activeTrip, loading, items, members, setItemPacked, deleteItem, duplicateItem, canContribute, postFeed } =
    useTrip();
  const { toast } = useToast();
  const [memberFilter, setMemberFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpacked' | 'packed' | 'toBuy'>('all');
  const [editing, setEditing] = useState<PackingItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PackingItem | null>(null);

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        if (memberFilter === 'shared' && i.member_id !== null) return false;
        if (memberFilter && memberFilter !== 'shared' && i.member_id !== memberFilter) return false;
        if (statusFilter === 'unpacked' && i.packed) return false;
        if (statusFilter === 'packed' && !i.packed) return false;
        if (statusFilter === 'toBuy' && i.status !== 'need' && i.status !== 'considering') return false;
        return true;
      }),
    [items, memberFilter, statusFilter]
  );

  const byCategory = useMemo(() => {
    const groups = new Map<string, PackingItem[]>();
    const order = [...PACKING_CATEGORIES] as string[];
    for (const item of filtered) {
      const key = item.category;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return [...groups.entries()].sort(
      (a, b) =>
        (order.indexOf(a[0]) + 1 || order.length + 1) - (order.indexOf(b[0]) + 1 || order.length + 1)
    );
  }, [filtered]);

  if (!activeTrip)
    return (
      <EmptyState
        icon="✅"
        title="No trip selected"
        body="Create or open a trip first — the packing list lives inside a trip."
        action={<Link to="/trips" className="text-sm font-semibold text-maroon underline underline-offset-2">Go to Trips →</Link>}
      />
    );
  if (loading) return <Spinner label="Loading the packing list" />;

  const packedCount = items.filter((i) => i.packed).length;
  const overallPct = items.length ? (packedCount / items.length) * 100 : 0;
  const lastMinute = items.filter((i) => i.last_minute && !i.packed);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Packing</h1>
          <p className="text-sm text-ink-faint">
            {packedCount}/{items.length} packed · {percent(overallPct)}
          </p>
        </div>
        {canContribute && <Button onClick={() => setAdding(true)}>✚ Add item</Button>}
      </div>

      <ProgressBar value={overallPct} label="Overall packing progress" />

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select
          value={memberFilter}
          onChange={(e) => setMemberFilter(e.target.value)}
          aria-label="Filter by traveler"
          className="max-w-[180px]"
        >
          <option value="">All travelers</option>
          <option value="shared">Shared items</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </Select>
        <div role="group" aria-label="Filter by status" className="flex overflow-hidden rounded-xl border border-line bg-white">
          {(
            [
              ['all', 'All'],
              ['unpacked', 'To pack'],
              ['packed', 'Packed'],
              ['toBuy', 'To buy'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              aria-pressed={statusFilter === key}
              className={`min-h-[44px] px-3 text-sm font-medium ${
                statusFilter === key ? 'bg-maroon text-white' : 'text-ink-soft'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {lastMinute.length > 0 && statusFilter === 'all' && (
        <Card className="!bg-cream">
          <p className="text-sm font-semibold text-ink">⏰ Last-minute items ({lastMinute.length})</p>
          <p className="text-xs text-ink-faint">
            {lastMinute.map((i) => i.name).slice(0, 6).join(' · ')}
            {lastMinute.length > 6 ? '…' : ''} — don't pack these until departure day.
          </p>
        </Card>
      )}

      {byCategory.length === 0 ? (
        <EmptyState
          icon="🎒"
          title="Nothing matches these filters"
          body={items.length === 0 ? 'Add your first item, or re-run trip creation to generate a list.' : 'Try a different traveler or status filter.'}
        />
      ) : (
        byCategory.map(([category, catItems]) => (
          <Card key={category} className="!p-0">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <h2 className="text-sm font-bold text-ink">{category}</h2>
              <span className="text-xs tabular-nums text-ink-faint">
                {catItems.filter((i) => i.packed).length}/{catItems.length}
              </span>
            </div>
            <ul className="divide-y divide-line">
              {catItems.map((item) => {
                const member = members.find((m) => m.id === item.member_id);
                return (
                  <li key={item.id} className="flex items-start gap-3 px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={item.packed}
                      disabled={!canContribute}
                      onChange={(e) => {
                        void setItemPacked(item.id, e.target.checked);
                        if (e.target.checked) void postFeed('packed', `packed ${item.name}`);
                      }}
                      aria-label={`Mark ${item.name} as packed`}
                      className="mt-1 h-6 w-6 shrink-0 rounded accent-[#0B6E6E]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${item.packed ? 'text-ink-faint line-through' : 'text-ink'}`}>
                        {item.name}
                        {item.qty > 1 && <span className="ml-1 text-xs text-ink-faint">×{item.qty}</span>}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {member ? <MemberChip member={member} /> : <Chip className="bg-cream text-ink-faint">Shared</Chip>}
                        <Chip className={BAG_STATUS_META[item.status].chip}>{BAG_STATUS_META[item.status].label}</Chip>
                        {!item.required && <Chip className="bg-cream text-ink-faint">Optional</Chip>}
                        {item.last_minute && <Chip className="bg-amber-100 text-amber-800">Last minute</Chip>}
                        {item.day && <Chip className="bg-sky-100 text-sky-800">{shortDate(item.day).replace(/, \d{4}$/, '')}</Chip>}
                      </div>
                      {item.notes && <p className="mt-0.5 text-xs text-ink-faint">{item.notes}</p>}
                    </div>
                    {canContribute && (
                      <div className="flex shrink-0 gap-0.5">
                        <button
                          type="button"
                          onClick={() => setEditing(item)}
                          aria-label={`Edit ${item.name}`}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-faint hover:bg-black/5"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void duplicateItem(item.id).then((r) => {
                              if (r.ok) toast('Item duplicated.', 'success');
                            });
                          }}
                          aria-label={`Duplicate ${item.name}`}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-faint hover:bg-black/5"
                        >
                          📄
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(item)}
                          aria-label={`Delete ${item.name}`}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-faint hover:bg-black/5"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        ))
      )}

      <ItemFormModal open={adding} onClose={() => setAdding(false)} />
      <ItemFormModal open={editing != null} onClose={() => setEditing(null)} item={editing} />
      <ConfirmDialog
        open={confirmDelete != null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) void deleteItem(confirmDelete.id);
        }}
        title={`Remove “${confirmDelete?.name ?? ''}”?`}
        body="This removes the item from the trip's packing list for everyone."
        confirmLabel="Remove item"
      />
    </div>
  );
}
