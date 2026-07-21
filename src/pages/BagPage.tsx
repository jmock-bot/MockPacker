import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTrip } from '../context/TripContext';
import { useToast } from '../context/ToastContext';
import { BAG_STATUSES, BAG_STATUS_META } from '../lib/statuses';
import { money } from '../lib/format';
import { Button, Card, Chip, EmptyState, Select, Spinner, Stat } from '../components/ui';
import { MemberChip, TripImage } from '../components/shared';
import { ItemFormModal } from '../components/ItemFormModal';
import type { BagStatus, PackingItem } from '../lib/types';

/**
 * The Bag: the trip's inventory. Not a checkout cart — it shows what each
 * traveler owns, plans to buy, has ordered, or has received. Purchases happen
 * at the retailer via the product link.
 */
export function BagPage() {
  const { activeTrip, loading, items, members, setItemStatus, setItemPacked, postFeed } = useTrip();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<BagStatus | 'all'>('all');
  const [memberFilter, setMemberFilter] = useState('');
  const [editing, setEditing] = useState<PackingItem | null>(null);

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        if (statusFilter !== 'all' && i.status !== statusFilter) return false;
        if (memberFilter === 'shared' && i.member_id !== null) return false;
        if (memberFilter && memberFilter !== 'shared' && i.member_id !== memberFilter) return false;
        return true;
      }),
    [items, statusFilter, memberFilter]
  );

  if (!activeTrip)
    return (
      <EmptyState
        icon="🎒"
        title="No trip selected"
        body="The Bag shows a trip's inventory — open a trip first."
        action={<Link to="/trips" className="text-sm font-semibold text-maroon underline underline-offset-2">Go to Trips →</Link>}
      />
    );
  if (loading) return <Spinner label="Opening the bag" />;

  const toBuy = items.filter((i) => i.status === 'need' || i.status === 'considering');
  const inTransit = items.filter((i) => i.status === 'ordered' || i.status === 'shipped');
  const estSpend = toBuy.reduce((sum, i) => sum + (i.est_price ?? 0) * i.qty, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Bag</h1>
          <p className="text-sm text-ink-faint">
            Trip inventory — own it, need it, ordered it, got it.
          </p>
        </div>
        <Button onClick={() => navigate('/search')}>🔍 Shop for items</Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="To buy" value={String(toBuy.length)} tone={toBuy.length ? 'bad' : 'good'} />
        <Stat label="On the way" value={String(inTransit.length)} />
        <Stat label="Est. to spend" value={money(estSpend)} sub="for needed items" />
      </div>

      {/* Status pipeline filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filter by bag status">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          aria-pressed={statusFilter === 'all'}
          className={`min-h-[38px] shrink-0 rounded-full border px-3 text-xs font-semibold ${
            statusFilter === 'all' ? 'border-maroon bg-maroon text-white' : 'border-line bg-white text-ink-soft'
          }`}
        >
          All ({items.length})
        </button>
        {BAG_STATUSES.map((s) => {
          const count = items.filter((i) => i.status === s).length;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              aria-pressed={statusFilter === s}
              className={`min-h-[38px] shrink-0 rounded-full border px-3 text-xs font-semibold ${
                statusFilter === s ? 'border-maroon bg-maroon text-white' : 'border-line bg-white text-ink-soft'
              }`}
            >
              {BAG_STATUS_META[s].label} ({count})
            </button>
          );
        })}
      </div>

      <Select
        value={memberFilter}
        onChange={(e) => setMemberFilter(e.target.value)}
        aria-label="Filter by traveler"
        className="max-w-[200px]"
      >
        <option value="">All travelers</option>
        <option value="shared">Shared items</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </Select>

      {filtered.length === 0 ? (
        <EmptyState
          icon="🛍️"
          title="Nothing here"
          body="Save products from Search or add items in Packing — they all live in the Bag."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((item) => {
            const member = members.find((m) => m.id === item.member_id);
            return (
              <Card key={item.id} className="flex items-start gap-3 !p-3">
                {item.external_image_url ? (
                  <TripImage
                    photo={{ external_url: item.external_image_url }}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-lg"
                  />
                ) : (
                  <div aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-cream text-xl">
                    🎒
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">
                    {item.name}
                    {item.qty > 1 && <span className="ml-1 text-xs font-normal text-ink-faint">×{item.qty}</span>}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    {member && <MemberChip member={member} />}
                    <Chip className={BAG_STATUS_META[item.status].chip}>{BAG_STATUS_META[item.status].label}</Chip>
                    {item.packed && <Chip className="bg-emerald-100 text-emerald-800">Packed ✓</Chip>}
                    {item.store && <Chip className="bg-cream text-ink-soft">{item.store}</Chip>}
                    {item.est_price != null && (
                      <span className="text-xs font-semibold tabular-nums text-ink">{money(item.est_price)}</span>
                    )}
                  </div>
                  {item.product_url && (
                    <a
                      href={item.product_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 inline-block text-xs font-semibold text-maroon underline underline-offset-2"
                    >
                      View at retailer ↗
                    </a>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Select
                    value={item.status}
                    onChange={(e) => {
                      const s = e.target.value as BagStatus;
                      void setItemStatus(item.id, s).then(() => {
                        if (s === 'ordered') void postFeed('purchase', `ordered ${item.name}`);
                        if (s === 'delivered') void postFeed('shipping', `${item.name} was delivered`);
                      });
                    }}
                    aria-label={`${item.name} status`}
                    className="!min-h-[36px] max-w-[140px] !text-xs"
                  >
                    {BAG_STATUSES.map((s) => (
                      <option key={s} value={s}>{BAG_STATUS_META[s].label}</option>
                    ))}
                  </Select>
                  <div className="flex gap-1">
                    <Button
                      variant={item.packed ? 'secondary' : 'success'}
                      className="!min-h-[32px] px-2 text-[11px]"
                      onClick={() => void setItemPacked(item.id, !item.packed)}
                    >
                      {item.packed ? 'Unpack' : 'Mark packed'}
                    </Button>
                    <Button variant="ghost" className="!min-h-[32px] px-2 text-[11px]" onClick={() => setEditing(item)}>
                      Edit
                    </Button>
                  </div>
                  {(item.status === 'ordered' || item.status === 'shipped') && (
                    <Link to="/shipments" className="text-[11px] font-semibold text-maroon underline underline-offset-2">
                      Track it →
                    </Link>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-ink-faint">
        MockPacker doesn't process purchases — product links take you to the retailer to buy.
      </p>

      <ItemFormModal open={editing != null} onClose={() => setEditing(null)} item={editing} />

      {toBuy.length > 0 && (
        <Button variant="secondary" onClick={() => { toast('Tip: search a needed item and save the best result to your Bag.', 'info'); navigate('/search'); }}>
          🔍 Find the {toBuy.length} item{toBuy.length > 1 ? 's' : ''} you still need
        </Button>
      )}
    </div>
  );
}
