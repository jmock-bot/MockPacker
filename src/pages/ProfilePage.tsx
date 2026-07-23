import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { publicAvatarUrl, uploadAvatar } from '../lib/supabase';
import { Button, Card, Field, SectionTitle, Select, TextArea, TextInput } from '../components/ui';
import { Icon } from '../components/Icon';

const FITS = ['', 'slim', 'regular', 'relaxed', 'oversized'];

export function ProfilePage() {
  const { session, profile, updateProfile, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [homeLocation, setHomeLocation] = useState('');
  const [shirtSize, setShirtSize] = useState('');
  const [pantsSize, setPantsSize] = useState('');
  const [dressSize, setDressSize] = useState('');
  const [shoeSize, setShoeSize] = useState('');
  const [fit, setFit] = useState('');
  const [genderNeutral, setGenderNeutral] = useState(false);
  const [colors, setColors] = useState('');
  const [style, setStyle] = useState('');
  const [travel, setTravel] = useState('');
  const [accessibility, setAccessibility] = useState('');
  const [care, setCare] = useState('');

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? '');
    setHomeLocation(profile.home_location ?? '');
    setShirtSize(profile.shirt_size ?? '');
    setPantsSize(profile.pants_size ?? '');
    setDressSize(profile.dress_size ?? '');
    setShoeSize(profile.shoe_size ?? '');
    setFit(profile.preferred_fit ?? '');
    setGenderNeutral(profile.gender_neutral ?? false);
    setColors(profile.favorite_colors ?? '');
    setStyle(profile.style_prefs ?? '');
    setTravel(profile.travel_prefs ?? '');
    setAccessibility(profile.accessibility_notes ?? '');
    setCare(profile.care_notes ?? '');
  }, [profile]);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    const msg = await updateProfile({
      display_name: displayName.trim(),
      home_location: homeLocation.trim() || null,
      shirt_size: shirtSize.trim() || null,
      pants_size: pantsSize.trim() || null,
      dress_size: dressSize.trim() || null,
      shoe_size: shoeSize.trim() || null,
      preferred_fit: fit || null,
      gender_neutral: genderNeutral,
      favorite_colors: colors.trim() || null,
      style_prefs: style.trim() || null,
      travel_prefs: travel.trim() || null,
      accessibility_notes: accessibility.trim() || null,
      care_notes: care.trim() || null,
    });
    setBusy(false);
    if (msg) toast(msg, 'error');
    else toast('Profile saved.', 'success');
  };

  const onAvatar = async (file: File | null) => {
    if (!file || !session) return;
    try {
      const path = await uploadAvatar(session.user.id, file);
      const msg = await updateProfile({ avatar_url: publicAvatarUrl(path) });
      if (msg) toast(msg, 'error');
      else toast('Profile photo updated.', 'success');
    } catch {
      toast('Could not upload the photo.', 'error');
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-bold text-ink">Profile</h1>

      <Card className="flex items-center gap-4">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-full bg-maroon text-2xl font-bold text-on-accent">
            {(displayName || '?').slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink">{displayName || 'Traveler'}</p>
          <p className="truncate text-xs text-ink-faint">{session?.user.email}</p>
          <label className="mt-1 inline-block cursor-pointer text-xs font-semibold text-maroon underline underline-offset-2">
            Change photo
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => void onAvatar(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <SectionTitle>About you</SectionTitle>
        <Field label="Name" required>
          {(id) => <TextInput id={id} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />}
        </Field>
        <Field label="Home location" hint="Used as your default departure point.">
          {(id) => <TextInput id={id} value={homeLocation} onChange={(e) => setHomeLocation(e.target.value)} placeholder="Atlanta, GA" />}
        </Field>
      </Card>

      <Card className="flex flex-col gap-4">
        <SectionTitle>Sizes & fit</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Shirt / top size">
            {(id) => <TextInput id={id} value={shirtSize} onChange={(e) => setShirtSize(e.target.value)} placeholder="M" />}
          </Field>
          <Field label="Pants size">
            {(id) => <TextInput id={id} value={pantsSize} onChange={(e) => setPantsSize(e.target.value)} placeholder="32×32" />}
          </Field>
          <Field label="Dress size">
            {(id) => <TextInput id={id} value={dressSize} onChange={(e) => setDressSize(e.target.value)} />}
          </Field>
          <Field label="Shoe size">
            {(id) => <TextInput id={id} value={shoeSize} onChange={(e) => setShoeSize(e.target.value)} placeholder="10.5" />}
          </Field>
          <Field label="Preferred fit">
            {(id) => (
              <Select id={id} value={fit} onChange={(e) => setFit(e.target.value)}>
                {FITS.map((f) => (
                  <option key={f} value={f}>{f ? f[0].toUpperCase() + f.slice(1) : '—'}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-medium text-ink-soft">
          <input
            type="checkbox"
            checked={genderNeutral}
            onChange={(e) => setGenderNeutral(e.target.checked)}
            className="h-5 w-5 rounded accent-[#0B6E6E]"
          />
          Prefer gender-neutral clothing suggestions
        </label>
      </Card>

      <Card className="flex flex-col gap-4">
        <SectionTitle>Preferences</SectionTitle>
        <Field label="Favorite colors">
          {(id) => <TextInput id={id} value={colors} onChange={(e) => setColors(e.target.value)} placeholder="navy, cream, olive" />}
        </Field>
        <Field label="Style preferences">
          {(id) => <TextArea id={id} rows={2} value={style} onChange={(e) => setStyle(e.target.value)} placeholder="Minimal, athleisure on travel days, no loud prints…" />}
        </Field>
        <Field label="Travel preferences">
          {(id) => <TextArea id={id} rows={2} value={travel} onChange={(e) => setTravel(e.target.value)} placeholder="Carry-on only, window seat, early flights…" />}
        </Field>
        <Field label="Accessibility / mobility considerations">
          {(id) => <TextArea id={id} rows={2} value={accessibility} onChange={(e) => setAccessibility(e.target.value)} />}
        </Field>
        <Field label="Allergies / personal-care requirements (optional)">
          {(id) => <TextArea id={id} rows={2} value={care} onChange={(e) => setCare(e.target.value)} />}
        </Field>
      </Card>

      <Button onClick={() => void save()} disabled={busy || !displayName.trim()}>
        {busy ? 'Saving…' : 'Save profile'}
      </Button>

      <Button
        variant="ghost"
        onClick={() => {
          void signOut().then(() => navigate('/login'));
        }}
      >
        <Icon name="logout" size={18} /> Sign out
      </Button>
    </div>
  );
}
