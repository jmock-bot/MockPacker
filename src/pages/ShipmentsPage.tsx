import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTrip } from '../context/TripContext';
import { useToast } from '../context/ToastContext';
import { CARRIERS, carrierName, trackingLink } from '../lib/carriers';
import { SHIPMENT_STATUSES, SHIPMENT_STATUS_META } from '../lib/statuses';
import { daysUntil, shortDate } from '../lib/format';
import { Button, Card, Chip, ConfirmDialog, EmptyState, Field, Modal, SectionTitle, Select, Spinner, TextInput, Warning } from '../components/ui';
import { MemberChip } from '../components/shared';
import type { Shipment, ShipmentStatus } from '../lib/types';

export function ShipmentsPage() {
  const { activeTrip, loading, shipments, items, members, saveShipment, deleteShipment, postFeed } =
    useTrip();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Shipment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Shipment | null>(null);

  const risk = useMemo(() => {
    if (!activeTrip) return { late: [] as Shipment[], close: [] as Shipment[], noTracking: [] as typeof items, notOrdered: [] as typeof items };
    const late = shipments.filter((s) => s.status === 'delayed' || s.status === 'exception' || (s.status !== 'delivered' && s.eta_date != null && s.eta_date >= activeTrip.start_date));
    const close = shipments.filter(
      (s) =>
        !late.includes(s) &&
        s.status !== 'delivered' &&
        s.eta_date != null &&
        (daysUntil(activeTrip.start_date) ?? 99) - (daysUntil(s.eta_date) ?? 0) <= 2
    );
    const noTracking = items.filter(
      (i) => i.status === 'ordered' && !shipments.some((s) => s.packing_item_id === i.id)
    );
    const notOrdered = items.filter((i) => i.status === 'need');
    return { late, close, noTracking, notOrdered };
  }, [activeTrip, shipments, items]);

  if (!activeTrip)
    return (
      <EmptyState
        icon="🚚"
        title="No trip selected"
        body="Shipment tracking lives inside a trip."
        action={<Link to="/trips" className="text-sm font-semibold text-maroon underline underline-offset-2">Go to Trips →</Link>}
      />
    );
  if (loading) return <Spinner label="Loading shipments" />;

  const hasRisk =
    risk.late.length > 0 || risk.close.length > 0 || risk.noTracking.length > 0 || risk.notOrdered.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Shipments</h1>
          <p className="text-sm text-ink-faint">
            Departure {shortDate(activeTrip.start_date)} — everything needs to land before then.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>✚ Add shipment</Button>
      </div>

      {/* Delivery risk */}
      {hasRisk && (
        <Card accent="#C0392B">
          <SectionTitle>⚠️ Delivery Risk</SectionTitle>
          <div className="flex flex-col gap-2">
            {risk.late.map((s) => (
              <Warning key={s.id} tone="rose">
                <strong>{s.retailer ?? carrierName(s.carrier)}</strong>{' '}
                {s.status === 'delayed' || s.status === 'exception'
                  ? `shipment is ${SHIPMENT_STATUS_META[s.status].label.toLowerCase()}`
                  : 'may arrive after departure'}
                {s.eta_date && ` — ETA ${shortDate(s.eta_date)}`}. Consider a local pickup or an
                in-store alternative.
              </Warning>
            ))}
            {risk.close.map((s) => (
              <Warning key={s.id}>
                <strong>{s.retailer ?? carrierName(s.carrier)}</strong> delivery is cutting it close
                (ETA {shortDate(s.eta_date)}).
              </Warning>
            ))}
            {risk.noTracking.length > 0 && (
              <Warning>
                {risk.noTracking.length} ordered item{risk.noTracking.length > 1 ? 's have' : ' has'} no
                tracking yet: {risk.noTracking.slice(0, 3).map((i) => i.name).join(', ')}
                {risk.noTracking.length > 3 ? '…' : ''} — add tracking so MockPacker can watch the ETA.
              </Warning>
            )}
            {risk.notOrdered.length > 0 && (
              <Warning>
                {risk.notOrdered.length} needed item{risk.notOrdered.length > 1 ? 's are' : ' is'} not
                ordered yet —{' '}
                <Link to="/search" className="font-semibold underline underline-offset-2">
                  shop now
                </Link>{' '}
                or plan to buy locally.
              </Warning>
            )}
          </div>
        </Card>
      )}

      {shipments.length === 0 ? (
        <EmptyState
          icon="📦"
          title="No shipments yet"
          body="When you order something for the trip, add its tracking here and MockPacker will flag anything that might miss departure."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {shipments.map((s) => {
            const meta = SHIPMENT_STATUS_META[s.status];
            const member = members.find((m) => m.id === s.member_id);
            const item = items.find((i) => i.id === s.packing_item_id);
            const link = trackingLink(s.carrier, s.tracking_number, s.tracking_url);
            const progress = ['order_placed', 'preparing', 'shipped', 'in_transit', 'out_for_delivery', 'delivered'].indexOf(s.status);
            return (
              <Card key={s.id} className="!p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      {s.retailer || carrierName(s.carrier)}
                      {s.order_number && <span className="ml-1.5 text-xs font-normal text-ink-faint">#{s.order_number}</span>}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <Chip className={meta.chip}>{meta.label}</Chip>
                      <Chip className="bg-cream text-ink-soft">{carrierName(s.carrier)}</Chip>
                      {member && <MemberChip member={member} />}
                      {item && <Chip className="bg-sky-100 text-sky-800">🎒 {item.name}</Chip>}
                    </div>
                  </div>
                  <div className="text-right text-xs text-ink-faint">
                    {s.eta_date && (
                      <p className={s.eta_date >= activeTrip.start_date ? 'font-bold text-rose-700' : ''}>
                        ETA {shortDate(s.eta_date)}
                      </p>
                    )}
                    {s.tracking_number && <p className="tabular-nums">{s.tracking_number}</p>}
                  </div>
                </div>

                {/* Progress dots */}
                {progress >= 0 && (
                  <div className="mt-2 flex items-center gap-1" aria-hidden="true">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <span
                        key={i}
                        className={`h-1.5 flex-1 rounded-full ${i <= progress ? (s.status === 'delivered' ? 'bg-emerald-600' : 'bg-maroon') : 'bg-line'}`}
                      />
                    ))}
                  </div>
                )}
                {meta.problem && (
                  <p className="mt-1.5 text-xs font-semibold text-rose-700">
                    Needs attention — check with the carrier or retailer.
                  </p>
                )}
                {s.last_scan && (
                  <p className="mt-1.5 text-xs text-ink-faint">📍 Latest scan: {s.last_scan}</p>
                )}

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {link && (
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-[34px] items-center rounded-xl border border-line bg-white px-2.5 text-xs font-semibold text-ink"
                    >
                      Track on {carrierName(s.carrier)} ↗
                    </a>
                  )}
                  {s.status !== 'delivered' && (
                    <Button
                      variant="success"
                      className="!min-h-[34px] px-2.5 text-xs"
                      onClick={() => {
                        void saveShipment({ id: s.id, status: 'delivered', packing_item_id: s.packing_item_id }).then(() => {
                          void postFeed('shipping', `${s.retailer ?? carrierName(s.carrier)} package was delivered`);
                          toast('Marked delivered — item moved to Delivered in the Bag.', 'success');
                        });
                      }}
                    >
                      ✓ Delivered
                    </Button>
                  )}
                  <Button variant="ghost" className="!min-h-[34px] px-2.5 text-xs" onClick={() => { setEditing(s); setFormOpen(true); }}>
                    Edit
                  </Button>
                  <Button variant="ghost" className="!min-h-[34px] px-2.5 text-xs text-rose-700" onClick={() => setDeleteTarget(s)}>
                    Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-ink-faint">
        Live carrier tracking uses a secure server-side integration (see{' '}
        <code>netlify/functions/track-shipment.ts</code>) — statuses can also be updated manually.
      </p>

      <ShipmentFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        shipment={editing}
        onSaved={() => toast('Shipment saved. 🚚', 'success')}
      />
      <ConfirmDialog
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) void deleteShipment(deleteTarget.id);
        }}
        title="Delete this shipment?"
        body="Tracking info will be removed. The linked packing item stays in the Bag."
      />
    </div>
  );
}

/* ── Shipment form ── */

function ShipmentFormModal({
  open,
  onClose,
  shipment,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  shipment: Shipment | null;
  onSaved: () => void;
}) {
  const { items, members, saveShipment } = useTrip();
  const { toast } = useToast();
  const [carrier, setCarrier] = useState('ups');
  const [tracking, setTracking] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [retailer, setRetailer] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [status, setStatus] = useState<ShipmentStatus>('order_placed');
  const [eta, setEta] = useState('');
  const [lastScan, setLastScan] = useState('');
  const [memberId, setMemberId] = useState('');
  const [itemId, setItemId] = useState('');
  const [busy, setBusy] = useState(false);
  const [prevKey, setPrevKey] = useState('');

  const keyNow = `${shipment?.id ?? 'new'}-${open}`;
  if (open && keyNow !== prevKey) {
    setPrevKey(keyNow);
    setCarrier(shipment?.carrier ?? 'ups');
    setTracking(shipment?.tracking_number ?? '');
    setTrackingUrl(shipment?.tracking_url ?? '');
    setRetailer(shipment?.retailer ?? '');
    setOrderNumber(shipment?.order_number ?? '');
    setStatus(shipment?.status ?? 'order_placed');
    setEta(shipment?.eta_date ?? '');
    setLastScan(shipment?.last_scan ?? '');
    setMemberId(shipment?.member_id ?? '');
    setItemId(shipment?.packing_item_id ?? '');
  }

  const save = async () => {
    if (busy) return;
    setBusy(true);
    const res = await saveShipment({
      id: shipment?.id,
      carrier,
      tracking_number: tracking.trim() || null,
      tracking_url: trackingUrl.trim() || null,
      retailer: retailer.trim() || null,
      order_number: orderNumber.trim() || null,
      status,
      eta_date: eta || null,
      last_scan: lastScan.trim() || null,
      member_id: memberId || null,
      packing_item_id: itemId || null,
    });
    setBusy(false);
    if (res.ok) {
      onSaved();
      onClose();
    } else {
      toast(res.error ?? 'Could not save the shipment.', 'error');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={shipment ? 'Edit shipment' : 'Add shipment'} wide>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Carrier">
            {(id) => (
              <Select id={id} value={carrier} onChange={(e) => setCarrier(e.target.value)}>
                {CARRIERS.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Tracking number">
            {(id) => <TextInput id={id} value={tracking} onChange={(e) => setTracking(e.target.value)} autoComplete="off" />}
          </Field>
          <Field label="Retailer">
            {(id) => <TextInput id={id} value={retailer} onChange={(e) => setRetailer(e.target.value)} placeholder="e.g. Nordstrom" />}
          </Field>
          <Field label="Order number">
            {(id) => <TextInput id={id} value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} autoComplete="off" />}
          </Field>
          <Field label="Status">
            {(id) => (
              <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as ShipmentStatus)}>
                {SHIPMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>{SHIPMENT_STATUS_META[s].label}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Estimated delivery">
            {(id) => <TextInput id={id} type="date" value={eta} onChange={(e) => setEta(e.target.value)} />}
          </Field>
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
          <Field label="Linked packing item" hint="Its Bag status follows the shipment.">
            {(id) => (
              <Select id={id} value={itemId} onChange={(e) => setItemId(e.target.value)}>
                <option value="">—</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Latest scan / note">
          {(id) => <TextInput id={id} value={lastScan} onChange={(e) => setLastScan(e.target.value)} placeholder="e.g. Departed Memphis hub" />}
        </Field>
        <Field label="Tracking link override" hint="Optional — some retailers use their own tracking page.">
          {(id) => <TextInput id={id} type="url" value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="https://…" />}
        </Field>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button className="flex-1" onClick={() => void save()} disabled={busy}>
            {busy ? 'Saving…' : 'Save shipment'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
