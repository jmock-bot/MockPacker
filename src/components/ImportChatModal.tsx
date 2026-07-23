import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrip } from '../context/TripContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import { todayIso } from '../lib/format';
import { activityKind } from '../lib/activities';
import { EXAMPLE_CHAT_TEXT, parseChatImport, splitChatLines } from '../lib/chatImport';
import { Button, Chip, Field, Modal, TextArea, TextInput, Warning } from './ui';
import { CityAutocomplete } from './CityAutocomplete';
import { Icon } from './Icon';

export function ImportChatModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createTrip } = useTrip();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [country, setCountry] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [travelers, setTravelers] = useState<string[]>([]);
  const [newTraveler, setNewTraveler] = useState('');
  const [detectedActivities, setDetectedActivities] = useState<{ label: string; kind: string }[]>([]);
  const [createdName, setCreatedName] = useState('');

  const reset = () => {
    setStep(0);
    setRaw('');
    setError(null);
    setName('');
    setCity('');
    setRegion('');
    setCountry('');
    setCoords(null);
    setStartDate('');
    setEndDate('');
    setTravelers([]);
    setNewTraveler('');
    setDetectedActivities([]);
  };

  const close = () => {
    onClose();
    // Let the closing transition read cleanly, then clear so reopening starts fresh.
    window.setTimeout(reset, 200);
  };

  const parseAndContinue = () => {
    const parsed = parseChatImport(raw);
    setName(parsed.suggestedName);
    setCity(parsed.city);
    setStartDate(parsed.startDate ?? '');
    setEndDate(parsed.endDate ?? '');
    setTravelers(parsed.travelers);
    setDetectedActivities(parsed.detectedActivities);
    setStep(1);
  };

  const canCreate =
    name.trim() && city.trim() && startDate && endDate && endDate >= startDate;

  const submit = async () => {
    if (!canCreate || busy) return;
    setBusy(true);
    setError(null);
    const res = await createTrip({
      name: name.trim(),
      trip_type: 'group',
      city: city.trim(),
      region: region.trim(),
      country: country.trim() || 'United States',
      lat: coords?.lat ?? null,
      lon: coords?.lon ?? null,
      lodging_type: null,
      lodging_name: null,
      address: null,
      depart_location: null,
      transport: null,
      start_date: startDate,
      end_date: endDate,
      laundry_available: false,
      notes: 'Created by importing a group chat.',
      travelers: travelers.map((t) => ({ name: t, email: null, role: 'traveler' as const })),
      activities: detectedActivities.map((a) => {
        const kind = activityKind(a.kind);
        return {
          name: a.label,
          kind: a.kind,
          date: null,
          start_time: null,
          end_time: null,
          location: null,
          dress_code: kind.defaultDress ?? null,
          setting: kind.defaultSetting ?? 'mixed',
          intensity: kind.defaultIntensity ?? 'low',
          equipment: null,
          notes: null,
        };
      }),
    });
    if (!res.ok || !res.id) {
      setBusy(false);
      setError(res.error ?? 'Could not create the trip.');
      return;
    }

    // Seed the chat thread from the pasted text, oldest first, ending with a
    // system marker — so "Chat" already has the conversation that started it.
    const lines = splitChatLines(raw);
    const now = Date.now();
    interface ChatRow {
      trip_id: string;
      author_id: null;
      author_name: string;
      body: string;
      kind: 'message' | 'system';
      created_at: string;
    }
    const rows: ChatRow[] = lines.map((l, i) => ({
      trip_id: res.id!,
      author_id: null,
      author_name: l.sender ?? 'Imported',
      body: l.body,
      kind: 'message',
      created_at: new Date(now - (lines.length - i) * 1000).toISOString(),
    }));
    rows.push({
      trip_id: res.id,
      author_id: null,
      author_name: '',
      body: '✨ Trip created by importing a group chat',
      kind: 'system' as const,
      created_at: new Date(now).toISOString(),
    });
    if (rows.length > 0) await supabase.from('chat_messages').insert(rows);

    setBusy(false);
    setCreatedName(name.trim());
    setStep(2);
    toast('Trip created from your group chat!', 'success');
  };

  return (
    <Modal open={open} onClose={close} title={step === 0 ? 'Create a trip from a group chat' : step === 1 ? 'We found a trip' : 'Trip created!'}>
      {step === 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-soft">
            Paste your group's chat — MockPacker looks for dates, a destination, who's going, and
            anything you mentioned needing.
          </p>
          <TextArea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={8}
            placeholder="Maya: ok so are we doing Lisbon Aug 14–20??"
            aria-label="Pasted group chat"
          />
          <button
            type="button"
            onClick={() => setRaw(EXAMPLE_CHAT_TEXT)}
            className="self-start text-xs font-semibold text-maroon underline underline-offset-2"
          >
            Try an example
          </button>
          <Button onClick={parseAndContinue} disabled={!raw.trim()}>
            Continue →
          </Button>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-soft">
            Here's what we picked up — edit anything before creating the trip.
          </p>
          <Field label="Trip name" required>
            {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label="Destination" required hint="Start typing to pick from suggestions.">
            {(id) => (
              <CityAutocomplete
                id={id}
                value={city}
                onChange={(v) => {
                  setCity(v);
                  setCoords(null);
                }}
                onSelect={(place) => {
                  setCity(place.name);
                  if (place.region) setRegion(place.region);
                  if (place.country) setCountry(place.country);
                  setCoords({ lat: place.lat, lon: place.lon });
                }}
              />
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
          <Field label="Travelers" hint="Detected from chat senders — add or remove anyone.">
            {() => (
              <div className="flex flex-col gap-2">
                {travelers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {travelers.map((t) => (
                      <Chip key={t} className="bg-cream text-ink-soft">
                        {t}
                        <button
                          type="button"
                          aria-label={`Remove ${t}`}
                          onClick={() => setTravelers((prev) => prev.filter((n) => n !== t))}
                          className="ml-1"
                        >
                          <Icon name="x" size={10} />
                        </button>
                      </Chip>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <TextInput
                    value={newTraveler}
                    onChange={(e) => setNewTraveler(e.target.value)}
                    placeholder="Add a traveler"
                    aria-label="Add a traveler"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0 px-3"
                    onClick={() => {
                      const n = newTraveler.trim();
                      if (n && !travelers.includes(n)) setTravelers((prev) => [...prev, n]);
                      setNewTraveler('');
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
            )}
          </Field>
          {detectedActivities.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink-soft">Detected</p>
              <div className="flex flex-wrap gap-1.5">
                {detectedActivities.map((a) => (
                  <Chip key={a.label} className="bg-maroon-tint text-maroon">
                    {a.label}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          {error && <Warning tone="rose">{error}</Warning>}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(0)} disabled={busy}>
              ← Back
            </Button>
            <span className="flex-1" />
            <Button onClick={() => void submit()} disabled={!canCreate || busy}>
              {busy ? 'Creating trip…' : 'Create trip'}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/15">
            <Icon name="check" size={26} className="text-emerald-700 dark:text-emerald-400" />
          </span>
          <h3 className="text-base font-bold text-ink">{createdName} is ready</h3>
          <p className="text-sm text-ink-soft">
            The packing list and trip chat are already synced with what was in your group chat.
          </p>
          <Button
            onClick={() => {
              close();
              navigate('/');
            }}
            className="w-full"
          >
            Go to trip
          </Button>
        </div>
      )}
    </Modal>
  );
}
