import { useState, type FormEvent } from 'react';
import { useTrip } from '../context/TripContext';
import { searchProducts, type SearchFilters } from '../lib/searchApi';
import { money } from '../lib/format';
import { Button, Card, Chip, EmptyState, Field, MoneyInput, Select, Spinner, TextInput, Warning } from '../components/ui';
import { ItemFormModal } from '../components/ItemFormModal';
import { PACKING_CATEGORIES } from '../lib/statuses';
import type { PackingItem, ProductResult } from '../lib/types';

export function SearchPage() {
  const { activeTrip } = useTrip();
  const [query, setQuery] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [brand, setBrand] = useState('');
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [store, setStore] = useState('');
  const [category, setCategory] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ProductResult[] | null>(null);
  const [saving, setSaving] = useState<Partial<PackingItem> | null>(null);
  const [compare, setCompare] = useState<ProductResult[]>([]);

  const search = async (e?: FormEvent) => {
    e?.preventDefault();
    const q = [query, brand, color, size].filter((s) => s.trim()).join(' ');
    if (!q.trim() || busy) return;
    setBusy(true);
    setError(null);
    const filters: SearchFilters = {};
    const min = parseFloat(priceMin);
    const max = parseFloat(priceMax);
    if (Number.isFinite(min)) filters.priceMin = min;
    if (Number.isFinite(max)) filters.priceMax = max;
    if (store.trim()) filters.store = store.trim();
    if (category) filters.category = category;
    const res = await searchProducts(q, filters);
    setBusy(false);
    setConfigured(res.configured);
    if (!res.ok && res.error) setError(res.error);
    let list = res.results;
    if (store.trim())
      list = list.filter((r) => (r.store ?? '').toLowerCase().includes(store.trim().toLowerCase()));
    setResults(list);
  };

  const startSave = (r: ProductResult) => {
    setSaving({
      name: r.name,
      category: category || 'Clothing',
      status: 'considering',
      store: r.store,
      est_price: r.price,
      product_url: r.url,
      external_image_url: r.imageUrl,
      required: false,
    });
  };

  const toggleCompare = (r: ProductResult) => {
    setCompare((prev) =>
      prev.some((x) => x.id === r.id) ? prev.filter((x) => x.id !== r.id) : [...prev.slice(-2), r]
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-ink">Shop for items</h1>
        <p className="text-sm text-ink-faint">
          Search real products, then save them to {activeTrip ? `“${activeTrip.name}”` : 'your trip'} and
          your Bag. Buying happens at the retailer.
        </p>
      </div>

      <form onSubmit={(e) => void search(e)} className="flex flex-col gap-3">
        <div className="flex gap-2">
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. white linen shirt"
            aria-label="Search products"
          />
          <Button type="submit" disabled={busy || !query.trim()} className="shrink-0">
            {busy ? '…' : 'Search'}
          </Button>
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((s) => !s)}
          className="self-start text-xs font-semibold text-maroon underline underline-offset-2"
          aria-expanded={showFilters}
        >
          {showFilters ? 'Hide filters' : 'Filters (price, brand, size, color, store…)'}
        </button>
        {showFilters && (
          <Card className="grid gap-3 sm:grid-cols-3">
            <Field label="Min price">{(id) => <MoneyInput id={id} value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />}</Field>
            <Field label="Max price">{(id) => <MoneyInput id={id} value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />}</Field>
            <Field label="Category">
              {(id) => (
                <Select id={id} value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">Any</option>
                  {PACKING_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Brand">{(id) => <TextInput id={id} value={brand} onChange={(e) => setBrand(e.target.value)} />}</Field>
            <Field label="Size">{(id) => <TextInput id={id} value={size} onChange={(e) => setSize(e.target.value)} />}</Field>
            <Field label="Color">{(id) => <TextInput id={id} value={color} onChange={(e) => setColor(e.target.value)} />}</Field>
            <Field label="Store">{(id) => <TextInput id={id} value={store} onChange={(e) => setStore(e.target.value)} placeholder="e.g. Target" />}</Field>
          </Card>
        )}
      </form>

      {error && <Warning tone="rose">{error}</Warning>}

      {!configured && (
        <Warning>
          Product search isn't connected yet. The site owner needs to set <code>SERPAPI_KEY</code>{' '}
          (an approved Google Shopping data provider) in the server environment — see the README.
          You can still add items manually from the Packing page.
        </Warning>
      )}

      {/* Compare tray */}
      {compare.length >= 2 && (
        <Card accent="#6e1423">
          <p className="mb-2 text-sm font-bold text-ink">Comparing {compare.length} products</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {compare.map((r) => (
              <div key={r.id} className="rounded-xl border border-line p-2 text-center">
                {r.imageUrl && <img src={r.imageUrl} alt="" className="mx-auto h-20 object-contain" loading="lazy" />}
                <p className="mt-1 line-clamp-2 text-xs font-medium text-ink">{r.name}</p>
                <p className="text-sm font-bold tabular-nums text-maroon">{money(r.price)}</p>
                <p className="text-[11px] text-ink-faint">{r.store}</p>
                {r.rating != null && <p className="text-[11px] text-ink-soft">★ {r.rating}{r.reviewCount ? ` (${r.reviewCount})` : ''}</p>}
                <p className="text-[11px] text-ink-faint">
                  {r.shippingCost === 0 ? 'Free shipping' : r.deliveryEstimate ?? ''}
                </p>
              </div>
            ))}
          </div>
          <Button variant="ghost" className="mt-2 !min-h-[34px] text-xs" onClick={() => setCompare([])}>
            Clear comparison
          </Button>
        </Card>
      )}

      {busy && <Spinner label="Searching stores" />}

      {results != null && !busy && (
        results.length === 0 ? (
          configured && (
            <EmptyState icon="🔍" title="No results" body="Try fewer words or remove a filter." />
          )
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {results.map((r) => (
              <Card key={r.id} className="flex gap-3 !p-3">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
                  {r.imageUrl ? (
                    <img src={r.imageUrl} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                  ) : (
                    <span aria-hidden="true" className="text-2xl">🛍️</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium text-ink">{r.name}</p>
                  <p className="text-xs text-ink-faint">{r.store}</p>
                  <p className="mt-0.5">
                    <span className="text-base font-bold tabular-nums text-maroon">{money(r.price)}</span>
                    {r.originalPrice != null && r.price != null && r.originalPrice > r.price && (
                      <>
                        <span className="ml-1.5 text-xs text-ink-faint line-through">{money(r.originalPrice)}</span>
                        {r.discountPercent != null && (
                          <Chip className="ml-1.5 bg-emerald-100 text-emerald-800">-{r.discountPercent}%</Chip>
                        )}
                      </>
                    )}
                  </p>
                  <p className="text-[11px] text-ink-faint">
                    {[
                      r.rating != null ? `★ ${r.rating}${r.reviewCount ? ` (${r.reviewCount})` : ''}` : null,
                      r.shippingCost === 0 ? 'Free shipping' : null,
                      r.deliveryEstimate,
                      r.inStock === false ? 'Out of stock' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Button className="!min-h-[34px] px-2.5 text-xs" onClick={() => startSave(r)}>
                      🎒 Add to Bag
                    </Button>
                    {r.url && (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-[34px] items-center rounded-xl border border-line bg-white px-2.5 text-xs font-semibold text-ink"
                      >
                        Retailer ↗
                      </a>
                    )}
                    <Button
                      variant="ghost"
                      className="!min-h-[34px] px-2 text-xs"
                      aria-pressed={compare.some((x) => x.id === r.id)}
                      onClick={() => toggleCompare(r)}
                    >
                      {compare.some((x) => x.id === r.id) ? '✓ Comparing' : '⇄ Compare'}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {results && results.length > 0 && (
        <p className="text-center text-xs text-ink-faint">
          Prices come from the search provider and can change at the retailer — verify before buying.
        </p>
      )}

      <ItemFormModal open={saving != null} onClose={() => setSaving(null)} initial={saving ?? undefined} />
    </div>
  );
}
