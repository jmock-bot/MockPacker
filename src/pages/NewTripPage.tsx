import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrip, type NewTripActivity } from '../context/TripContext';
import { useToast } from '../context/ToastContext';
import { ACTIVITY_KINDS } from '../lib/activities';
import { DRESS_CODES, LODGING_TYPES, TRANSPORTS, TRIP_TYPES } from '../lib/statuses';
import { todayIso } from '../lib/format';
import { Button, Card, Field, Select, TextArea, TextInput, Warning } from '../components/ui';
import { CityAutocomplete } from '../components/CityAutocomplete';
import type { TripKind, TripRole } from '../lib/types';

interface TravelerDraft {
  name: string;
  email: string;
  role: TripRole;
}

const STEPS = ['Basics', 'Destination', 'Travelers', 'Activities', 'Review'] as const;

export function NewTripPage() {
  const { createTrip } = useTrip();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Step 1 — basics */
  const [name, setName] = useState('');
  const [tripType, setTripType] = useState<TripKind>('personal');
  const [departLocation, setDepartLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [transport, setTransport] = useState('flight');
  const [lodgingType, setLodgingType] = useState('hotel');
  const [laundry, setLaundry] = useState(false);

  /* Step 2 — destination */
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [country, setCountry] = useState('United States');
  // Coordinates captured when a city is picked from autocomplete — lets us
  // skip a second geocode and guarantees the forecast matches the chosen city.
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [lodgingName, setLodgingName] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  /* Step 3 — travelers */
  const [travelers, setTravelers] = useState<TravelerDraft[]>([]);

  /* Step 4 — activities */
  const [selectedKinds, setSelectedKinds] = useState<Set<string>>(new Set());
  const [activityDetails, setActivityDetails] = useState<Record<string, Partial<NewTripActivity>>>({});
  const [customActivity, setCustomActivity] = useState('');

  const validateStep = (): string | null => {
    if (step === 0) {
      if (!name.trim()) return 'Give the trip a name.';
      if (!startDate || !endDate) return 'Choose the departure and return dates.';
      if (endDate < startDate) return 'The return date must be after departure.';
      if (startDate < todayIso()) return 'The departure date is in the past.';
    }
    if (step === 1 && !city.trim()) return 'Enter the destination city.';
    return null;
  };

  const next = () => {
    const msg = validateStep();
    setError(msg);
    if (!msg) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const toggleKind = (id: string) => {
    setSelectedKinds((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(id)) nextSet.delete(id);
      else nextSet.add(id);
      return nextSet;
    });
  };

  const buildActivities = (): NewTripActivity[] => {
    const list: NewTripActivity[] = [];
    for (const id of selectedKinds) {
      const kind = ACTIVITY_KINDS.find((k) => k.id === id);
      if (!kind) continue;
      const d = activityDetails[id] ?? {};
      list.push({
        name: kind.label,
        kind: id,
        date: d.date ?? null,
        start_time: d.start_time ?? null,
        end_time: d.end_time ?? null,
        location: d.location ?? null,
        dress_code: d.dress_code ?? kind.defaultDress ?? null,
        setting: d.setting ?? kind.defaultSetting ?? 'mixed',
        intensity: d.intensity ?? kind.defaultIntensity ?? 'low',
        equipment: d.equipment ?? null,
        notes: d.notes ?? null,
      });
    }
    if (customActivity.trim()) {
      list.push({
        name: customActivity.trim(),
        kind: 'custom',
        date: null,
        start_time: null,
        end_time: null,
        location: null,
        dress_code: null,
        setting: 'mixed',
        intensity: 'low',
        equipment: null,
        notes: null,
      });
    }
    return list;
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await createTrip({
      name: name.trim(),
      trip_type: tripType,
      city: city.trim(),
      region: region.trim(),
      country: country.trim(),
      lat: coords?.lat ?? null,
      lon: coords?.lon ?? null,
      lodging_type: lodgingType,
      lodging_name: lodgingName.trim() || null,
      address: address.trim() || null,
      depart_location: departLocation.trim() || null,
      transport,
      start_date: startDate,
      end_date: endDate,
      laundry_available: laundry,
      notes: notes.trim() || null,
      travelers: travelers
        .filter((t) => t.name.trim())
        .map((t) => ({ name: t.name.trim(), email: t.email.trim() || null, role: t.role })),
      activities: buildActivities(),
    });
    setBusy(false);
    if (res.ok) {
      toast('Trip created — your packing list is ready! 🎒', 'success');
      navigate('/packing');
    } else {
      setError(res.error ?? 'Could not create the trip.');
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-bold text-ink">Plan a Trip</h1>
      {/* Step indicator */}
      <ol className="my-4 flex items-center gap-1" aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 flex-col items-center gap-1">
            <span
              aria-hidden="true"
              className={`h-1.5 w-full rounded-full ${i <= step ? 'bg-maroon' : 'bg-line'}`}
            />
            <span className={`text-[10px] font-semibold ${i === step ? 'text-maroon' : 'text-ink-faint'}`}>
              {label}
            </span>
          </li>
        ))}
      </ol>

      <Card className="flex flex-col gap-4">
        {step === 0 && (
          <>
            <Field label="Trip name" required>
              {(id) => (
                <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Cousins' Beach Week" />
              )}
            </Field>
            <Field label="What kind of trip is this?">
              {(id) => (
                <Select id={id} value={tripType} onChange={(e) => setTripType(e.target.value as TripKind)}>
                  {TRIP_TYPES.map((t) => (
                    <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>
                  ))}
                </Select>
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Departure date" required>
                {(id) => (
                  <TextInput id={id} type="date" value={startDate} min={todayIso()} onChange={(e) => setStartDate(e.target.value)} />
                )}
              </Field>
              <Field label="Return date" required>
                {(id) => (
                  <TextInput id={id} type="date" value={endDate} min={startDate || todayIso()} onChange={(e) => setEndDate(e.target.value)} />
                )}
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="How are you getting there?">
                {(id) => (
                  <Select id={id} value={transport} onChange={(e) => setTransport(e.target.value)}>
                    {TRANSPORTS.map((t) => (
                      <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Where are you staying?">
                {(id) => (
                  <Select id={id} value={lodgingType} onChange={(e) => setLodgingType(e.target.value)}>
                    {LODGING_TYPES.map((t) => (
                      <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <Field label="Departure location" hint="Where the trip starts — used for travel-day planning.">
              {(id) => (
                <TextInput id={id} value={departLocation} onChange={(e) => setDepartLocation(e.target.value)} placeholder="Atlanta, GA" />
              )}
            </Field>
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-medium text-ink-soft">
              <input
                type="checkbox"
                checked={laundry}
                onChange={(e) => setLaundry(e.target.checked)}
                className="h-5 w-5 rounded accent-[#6e1423]"
              />
              Laundry will be available (packs lighter)
            </label>
          </>
        )}

        {step === 1 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City" required hint="Start typing to pick from suggestions.">
                {(id) => (
                  <CityAutocomplete
                    id={id}
                    value={city}
                    onChange={(v) => {
                      setCity(v);
                      // Typing after a pick invalidates the captured coordinates.
                      setCoords(null);
                    }}
                    onSelect={(place) => {
                      setCity(place.name);
                      if (place.region) setRegion(place.region);
                      if (place.country) setCountry(place.country);
                      setCoords({ lat: place.lat, lon: place.lon });
                    }}
                    placeholder="Hilton Head Island"
                  />
                )}
              </Field>
              <Field label="State / region">
                {(id) => <TextInput id={id} value={region} onChange={(e) => setRegion(e.target.value)} placeholder="South Carolina" />}
              </Field>
            </div>
            <Field label="Country">
              {(id) => <TextInput id={id} value={country} onChange={(e) => setCountry(e.target.value)} />}
            </Field>
            <Field label="Lodging name" hint="Hotel, resort, cruise ship, campground, rental, or venue.">
              {(id) => <TextInput id={id} value={lodgingName} onChange={(e) => setLodgingName(e.target.value)} placeholder="Sea Oats Beach House" />}
            </Field>
            <Field label="Address (optional)">
              {(id) => <TextInput id={id} value={address} onChange={(e) => setAddress(e.target.value)} />}
            </Field>
            <Field label="Trip notes (optional)" hint="Multiple stops? List them here — multi-destination support carries them with the trip.">
              {(id) => <TextArea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}
            </Field>
            <p className="text-xs text-ink-faint">
              ☁️ MockPacker uses the destination to pull the weather forecast and tailor the packing
              list.
            </p>
          </>
        )}

        {step === 2 && (
          <>
            <p className="text-sm text-ink-soft">
              Add the people traveling with you. They'll each get their own packing checklist, and
              you can send invitation links from the Group page after the trip is created.
            </p>
            {travelers.map((t, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-xl border border-line bg-white p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <TextInput
                    value={t.name}
                    onChange={(e) =>
                      setTravelers((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                    }
                    placeholder="Traveler name"
                    aria-label={`Traveler ${i + 1} name`}
                  />
                  <TextInput
                    type="email"
                    value={t.email}
                    onChange={(e) =>
                      setTravelers((prev) => prev.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))
                    }
                    placeholder="Email (optional)"
                    aria-label={`Traveler ${i + 1} email`}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={t.role}
                    onChange={(e) =>
                      setTravelers((prev) =>
                        prev.map((x, j) => (j === i ? { ...x, role: e.target.value as TripRole } : x))
                      )
                    }
                    aria-label={`Traveler ${i + 1} role`}
                    className="max-w-[180px]"
                  >
                    <option value="traveler">Traveler</option>
                    <option value="organizer">Organizer</option>
                    <option value="viewer">Viewer</option>
                  </Select>
                  <Button
                    variant="ghost"
                    className="!min-h-[36px] px-2 text-xs text-rose-700"
                    onClick={() => setTravelers((prev) => prev.filter((_, j) => j !== i))}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <Button
              variant="secondary"
              onClick={() => setTravelers((prev) => [...prev, { name: '', email: '', role: 'traveler' }])}
            >
              ✚ Add a traveler
            </Button>
          </>
        )}

        {step === 3 && (
          <>
            <p className="text-sm text-ink-soft">
              What's on the agenda? Pick everything that applies — the packing engine uses this to
              add gear, outfits, and equipment.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ACTIVITY_KINDS.filter((k) => k.id !== 'custom').map((k) => {
                const on = selectedKinds.has(k.id);
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => toggleKind(k.id)}
                    aria-pressed={on}
                    className={`flex min-h-[48px] items-center gap-2 rounded-xl border px-3 text-left text-sm font-medium transition-colors ${
                      on ? 'border-maroon bg-maroon-tint text-maroon' : 'border-line bg-white text-ink-soft'
                    }`}
                  >
                    <span aria-hidden="true">{k.icon}</span>
                    {k.label}
                  </button>
                );
              })}
            </div>
            <Field label="Custom activity (optional)">
              {(id) => (
                <TextInput id={id} value={customActivity} onChange={(e) => setCustomActivity(e.target.value)} placeholder="e.g. Cooking class" />
              )}
            </Field>
            {[...selectedKinds].length > 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-semibold text-ink">Add details (optional)</p>
                {[...selectedKinds].map((id) => {
                  const kind = ACTIVITY_KINDS.find((k) => k.id === id);
                  if (!kind) return null;
                  const d = activityDetails[id] ?? {};
                  const set = (patch: Partial<NewTripActivity>) =>
                    setActivityDetails((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
                  return (
                    <details key={id} className="rounded-xl border border-line bg-white p-3">
                      <summary className="cursor-pointer text-sm font-semibold text-ink">
                        {kind.icon} {kind.label}
                      </summary>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <TextInput type="date" value={d.date ?? ''} min={startDate} max={endDate} onChange={(e) => set({ date: e.target.value || null })} aria-label={`${kind.label} date`} />
                        <TextInput value={d.location ?? ''} onChange={(e) => set({ location: e.target.value || null })} placeholder="Location" aria-label={`${kind.label} location`} />
                        <TextInput type="time" value={d.start_time ?? ''} onChange={(e) => set({ start_time: e.target.value || null })} aria-label={`${kind.label} start time`} />
                        <TextInput type="time" value={d.end_time ?? ''} onChange={(e) => set({ end_time: e.target.value || null })} aria-label={`${kind.label} end time`} />
                        <Select value={d.dress_code ?? kind.defaultDress ?? ''} onChange={(e) => set({ dress_code: e.target.value || null })} aria-label={`${kind.label} dress code`}>
                          <option value="">Dress code…</option>
                          {DRESS_CODES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </Select>
                        <Select value={d.setting ?? kind.defaultSetting ?? 'mixed'} onChange={(e) => set({ setting: e.target.value })} aria-label={`${kind.label} setting`}>
                          <option value="indoor">Indoor</option>
                          <option value="outdoor">Outdoor</option>
                          <option value="mixed">Indoor + outdoor</option>
                        </Select>
                        <Select value={d.intensity ?? kind.defaultIntensity ?? 'low'} onChange={(e) => set({ intensity: e.target.value })} aria-label={`${kind.label} activity level`}>
                          <option value="low">Relaxed</option>
                          <option value="moderate">Moderate</option>
                          <option value="high">Very active</option>
                        </Select>
                        <TextInput value={d.equipment ?? ''} onChange={(e) => set({ equipment: e.target.value || null })} placeholder="Required equipment" aria-label={`${kind.label} equipment`} />
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <p className="text-sm text-ink-soft">Ready? Here's what MockPacker will set up:</p>
            <ul className="flex flex-col gap-1.5 text-sm text-ink-soft">
              <li>🧳 <strong className="text-ink">{name || 'Your trip'}</strong> — {city}{region ? `, ${region}` : ''} · {startDate} → {endDate}</li>
              <li>👥 {travelers.filter((t) => t.name.trim()).length + 1} traveler(s), each with their own checklist</li>
              <li>🎯 {buildActivities().length} planned activit{buildActivities().length === 1 ? 'y' : 'ies'}</li>
              <li>☁️ Weather forecast for each day (when in range)</li>
              <li>🎒 A personalized packing list generated from all of the above — edit anything afterwards</li>
            </ul>
          </>
        )}

        {error && <Warning tone="rose">{error}</Warning>}

        <div className="flex gap-2 pt-1">
          {step > 0 && (
            <Button variant="secondary" onClick={() => setStep((s) => s - 1)} disabled={busy}>
              ← Back
            </Button>
          )}
          <span className="flex-1" />
          {step < STEPS.length - 1 ? (
            <Button onClick={next}>Continue →</Button>
          ) : (
            <Button onClick={() => void submit()} disabled={busy}>
              {busy ? 'Building your packing list…' : '🎒 Create trip + packing list'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
