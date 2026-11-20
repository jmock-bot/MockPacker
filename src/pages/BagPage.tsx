import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTrip } from '../context/TripContext';
import { useToast } from '../context/ToastContext';
import { BAG_STATUSES, BAG_STATUS_META } from '../lib/statuses';
import { money } from '../lib/format';
import { Button, Card, Chip, EmptyState, Select, Spinner } from '../components/ui';
import { MemberChip, TripImage } from '../components/shared';
import { Icon } from '../components/Icon';
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
        icon="bag"
        title="No trip selected"
        body="The Bag shows a trip's inventory — open a trip first."
        action={<Link to="/trips" className="inline-flex min-h-[44px] items-center text-body font-semibold text-accent underline underline-offset-2">Go to Trips →</Link>}
      />
    );
  if (loading) return <Spinner label="Opening the bag" />;

  const toBuy = items.filter((i) => i.status === 'need' || i.status === 'considering');
  const inTransit = items.filter((i) => i.status === 'ordered' || i.status === 'shipped');
  const estSpend = toBuy.reduce((sum, i) => sum + (i.est_price ?? 0) * i.qty, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Hero: what's left to spend. */}
      <header className="hero-glide flex flex-wrap items-end justify-between gap-3 pt-2">
        <div>
          <h1 className="text-label text-ink-soft">Bag</h1>
          <p className="mt-1 text-ink">
            <span className="text-display tabular-nums">{money(estSpend)}</span>{' '}
            <span className="text-body font-semibold text-ink-soft">to spend</span>
          </p>
          <p className="mt-1 text-body text-ink-soft">
            <span className={`font-bold ${toBuy.length ? 'text-danger' : 'text-success'}`}>{toBuy.length}</span> to buy ·{' '}
            <span className="font-bold text-ink">{inTransit.length}</span> on the way
          </p>
        </div>
        <Button onClick={() => navigate('/search')}><Icon name="search" size={18} /> Shop for items</Button>
      </header>

      {/* Status pipeline filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filter by bag status">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          aria-pressed={statusFilter === 'all'}
          className={`min-h-[44px] shrink-0 rounded-full border px-3 text-label font-semibold ${
            statusFilter === 'all' ? 'border-accent bg-accent text-on-accent' : 'border-line bg-card text-ink-soft'
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
              className={`min-h-[44px] shrink-0 rounded-full border px-3 text-label font-semibold ${
                statusFilter === s ? 'border-accent bg-accent text-on-accent' : 'border-line bg-card text-ink-soft'
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
          icon="cart"
          title="Nothing here"
          body="Save products from Search or add items in Packing — they all live in the Bag."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((item) => {
            const member = members.find((m) => m.id === item.member_id);
            return (
              <Card key={item.id} className="flex flex-wrap items-start gap-3 !p-3 sm:flex-nowrap">
                {item.external_image_url ? (
                  <TripImage
                    photo={{ external_url: item.external_image_url }}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-lg"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-cream text-ink-faint">
                    <Icon name="bag" size={26} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-body font-semibold text-ink">
                    {item.name}
                    {item.qty > 1 && <span className="ml-1 text-caption font-normal text-ink-faint">×{item.qty}</span>}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    {member && <MemberChip member={member} />}
                    <Chip className={BAG_STATUS_META[item.status].chip}>{BAG_STATUS_META[item.status].label}</Chip>
                    {item.packed && <Chip tone="success"><Icon name="check" size={12} /> Packed</Chip>}
                    {item.store && <Chip tone="neutral">{item.store}</Chip>}
                    {item.est_price != null && (
                      <span className="text-label font-semibold tabular-nums text-ink">{money(item.est_price)}</span>
                    )}
                  </div>
                  {item.product_url && (
                    <a
                      href={item.product_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-[44px] items-center mt-0.5 inline-block text-label font-semibold text-accent underline underline-offset-2"
                    >
                      View at retailer ↗
                    </a>
                  )}
                </div>
                <div className="flex w-full shrink-0 flex-row flex-wrap items-center justify-between gap-1.5 sm:w-auto sm:flex-col sm:items-end">
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
                    className="max-w-[140px] !text-caption"
                  >
                    {BAG_STATUSES.map((s) => (
                      <option key={s} value={s}>{BAG_STATUS_META[s].label}</option>
                    ))}
                  </Select>
                  <div className="flex gap-1">
                    <Button
                      variant="secondary"
                      className="px-3 text-caption"
                      onClick={() => void setItemPacked(item.id, !item.packed)}
                    >
                      {item.packed ? 'Unpack' : 'Mark packed'}
                    </Button>
                    <Button variant="tertiary" className="px-3 text-caption" onClick={() => setEditing(item)}>
                      Edit
                    </Button>
                  </div>
                  {(item.status === 'ordered' || item.status === 'shipped') && (
                    <Link to="/shipments" className="inline-flex min-h-[44px] items-center text-caption font-semibold text-accent underline underline-offset-2">
                      Track it →
                    </Link>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-center text-caption text-ink-faint">
        MockPacker doesn't process purchases — product links take you to the retailer to buy.
      </p>

      <ItemFormModal open={editing != null} onClose={() => setEditing(null)} item={editing} />

      {toBuy.length > 0 && (
        <Button variant="secondary" onClick={() => { toast('Tip: search a needed item and save the best result to your Bag.', 'info'); navigate('/search'); }}>
          <Icon name="search" size={18} /> Find the {toBuy.length} item{toBuy.length > 1 ? 's' : ''} you still need
        </Button>
      )}
    </div>
  );
}
