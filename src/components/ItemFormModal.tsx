import { useEffect, useState } from 'react';
import { useTrip } from '../context/TripContext';
import { useToast } from '../context/ToastContext';
import { BAG_STATUSES, BAG_STATUS_META, PACKING_CATEGORIES } from '../lib/statuses';
import { clampQty, parseMoney } from '../lib/format';
import { Button, Field, Modal, MoneyInput, Select, Stepper, TextArea, TextInput } from './ui';
import type { BagStatus, PackingItem } from '../lib/types';

/**
 * Add/edit a packing item. Also used to save a product from search results —
 * pass `initial` with name/store/price/url prefilled.
 */
export function ItemFormModal({
  open,
  onClose,
  item,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  item?: PackingItem | null;
  initial?: Partial<PackingItem>;
}) {
  const { members, activities, tripDays, addItem, updateItem } = useTrip();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('Clothing');
  const [qty, setQty] = useState(1);
  const [memberId, setMemberId] = useState<string>('');
  const [status, setStatus] = useState<BagStatus>('own');
  const [required, setRequired] = useState(true);
  const [lastMinute, setLastMinute] = useState(false);
  const [day, setDay] = useState('');
  const [activityId, setActivityId] = useState('');
  const [notes, setNotes] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [store, setStore] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const src = item ?? initial ?? {};
    setName(src.name ?? '');
    setCategory(src.category ?? 'Clothing');
    setQty(src.qty ?? 1);
    setMemberId(src.member_id ?? '');
    setStatus(src.status ?? 'own');
    setRequired(src.required ?? true);
    setLastMinute(src.last_minute ?? false);
    setDay(src.day ?? '');
    setActivityId(src.activity_id ?? '');
    setNotes(src.notes ?? '');
    setProductUrl(src.product_url ?? '');
    setStore(src.store ?? '');
    setPrice(src.est_price != null ? String(src.est_price) : '');
  }, [open, item, initial]);

  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    const payload: Partial<PackingItem> & { name: string } = {
      name: name.trim(),
      category,
      qty: clampQty(qty),
      member_id: memberId || null,
      status,
      required,
      last_minute: lastMinute,
      day: day || null,
      activity_id: activityId || null,
      notes: notes.trim() || null,
      product_url: productUrl.trim() || null,
      store: store.trim() || null,
      est_price: parseMoney(price),
      external_image_url: (item ?? initial)?.external_image_url ?? null,
    };
    const res = item ? await updateItem(item.id, payload) : await addItem(payload);
    setBusy(false);
    if (res.ok) {
      toast(item ? 'Item updated.' : 'Added to the trip!', 'success');
      onClose();
    } else {
      toast(res.error ?? 'Could not save the item.', 'error');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={item ? 'Edit item' : 'Add item'} wide>
      <div className="flex flex-col gap-4">
        <Field label="Item name" required>
          {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rain jacket" />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            {(id) => (
              <Select id={id} value={category} onChange={(e) => setCategory(e.target.value)}>
                {PACKING_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Assigned traveler">
            {(id) => (
              <Select id={id} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                <option value="">Shared / whole group</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Bag status" hint="Own it, need it, or somewhere in between.">
            {(id) => (
              <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as BagStatus)}>
                {BAG_STATUSES.map((s) => (
                  <option key={s} value={s}>{BAG_STATUS_META[s].label}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Quantity">
            {() => <Stepper value={qty} onChange={setQty} label="quantity" />}
          </Field>
          <Field label="Recommended day">
            {(id) => (
              <Select id={id} value={day} onChange={(e) => setDay(e.target.value)}>
                <option value="">Any day</option>
                {tripDays.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="For activity">
            {(id) => (
              <Select id={id} value={activityId} onChange={(e) => setActivityId(e.target.value)}>
                <option value="">—</option>
                {activities.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-medium text-ink-soft">
            <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="h-5 w-5 rounded accent-[#0B6E6E]" />
            Required
          </label>
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-medium text-ink-soft">
            <input type="checkbox" checked={lastMinute} onChange={(e) => setLastMinute(e.target.checked)} className="h-5 w-5 rounded accent-[#0B6E6E]" />
            Pack at the last minute
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Store">
            {(id) => <TextInput id={id} value={store} onChange={(e) => setStore(e.target.value)} placeholder="Retailer" />}
          </Field>
          <Field label="Est. price">
            {(id) => <MoneyInput id={id} value={price} onChange={(e) => setPrice(e.target.value)} />}
          </Field>
          <Field label="Product link">
            {(id) => <TextInput id={id} type="url" value={productUrl} onChange={(e) => setProductUrl(e.target.value)} placeholder="https://…" />}
          </Field>
        </div>
        <Field label="Notes">
          {(id) => <TextArea id={id} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={() => void save()} disabled={busy || !name.trim()}>
            {busy ? 'Saving…' : item ? 'Save changes' : 'Add item'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
