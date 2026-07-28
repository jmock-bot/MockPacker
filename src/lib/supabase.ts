import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
// The browser client key. Prefer the new publishable key (sb_publishable_…);
// fall back to the legacy anon key so existing deployments keep working. Both
// are safe to expose — Row Level Security is what actually protects the data.
const publishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

/** True when Supabase env vars are present; the app shows setup help if not. */
export const supabaseConfigured = Boolean(url && publishableKey);

export const supabase: SupabaseClient = createClient(
  url ?? 'https://not-configured.supabase.co',
  publishableKey ?? 'anon-key-not-configured'
);

/** Avatars are public; trip photos are private and served via signed URLs. */
export const publicAvatarUrl = (path: string): string =>
  supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;

export async function signedPhotoUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('trip-photos').createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

const randomName = (file: File): string => {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
};

/** Upload into the private trip bucket under the trip's folder (RLS-scoped). */
export async function uploadTripPhoto(tripId: string, file: File): Promise<string> {
  const path = `${tripId}/${randomName(file)}`;
  const { error } = await supabase.storage.from('trip-photos').upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const path = `${userId}/${randomName(file)}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw error;
  return path;
}
