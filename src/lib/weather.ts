/**
 * Weather via Open-Meteo (https://open-meteo.com) — free for non-commercial
 * use, no API key required, so nothing secret ever touches the client.
 * Forecasts only exist ~16 days out; farther dates return null fields and the
 * UI shows "forecast not available yet".
 */
import type { WeatherDay } from './types';

export interface GeoResult {
  name: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
}

interface GeoApiHit {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
}

const toGeoResult = (hit: GeoApiHit): GeoResult => ({
  name: hit.name,
  region: hit.admin1 ?? '',
  country: hit.country ?? '',
  lat: hit.latitude,
  lon: hit.longitude,
});

/**
 * Autocomplete search: up to `limit` matching cities for a typed query.
 * Accepts an AbortSignal so the caller can cancel stale in-flight requests as
 * the user keeps typing. Returns [] on error/empty rather than throwing.
 */
export async function searchCities(
  query: string,
  limit = 6,
  signal?: AbortSignal
): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=${limit}&language=en&format=json`,
      { signal: signal ?? AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: GeoApiHit[] };
    return (data.results ?? []).map(toGeoResult);
  } catch {
    return [];
  }
}

export async function geocode(query: string): Promise<GeoResult | null> {
  const q = query.trim();
  if (!q) return null;
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: GeoApiHit[] };
    const hit = data.results?.[0];
    return hit ? toGeoResult(hit) : null;
  } catch {
    return null;
  }
}

const cacheKey = (lat: number, lon: number, start: string, end: string) =>
  `mp-wx-${lat.toFixed(2)},${lon.toFixed(2)},${start},${end}`;

/**
 * Daily forecast for the trip window. Dates beyond the forecast horizon are
 * returned with null values so every trip day still gets a row.
 */
export async function fetchTripWeather(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string,
  allDays: string[]
): Promise<WeatherDay[]> {
  const blank = allDays.map((date) => ({
    date,
    tMax: null,
    tMin: null,
    precipProb: null,
    windMax: null,
    code: null,
  }));

  // Open-Meteo serves at most ~16 days ahead; clamp the request window.
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 15);
  const horizonIso = horizon.toISOString().slice(0, 10);
  const reqStart = startDate <= horizonIso ? startDate : null;
  if (!reqStart) return blank;
  const reqEnd = endDate <= horizonIso ? endDate : horizonIso;

  const key = cacheKey(lat, lon, reqStart, reqEnd);
  try {
    const cached = JSON.parse(sessionStorage.getItem(key) ?? 'null') as
      | { at: number; days: WeatherDay[] }
      | null;
    if (cached && Date.now() - cached.at < 60 * 60_000) {
      return blank.map((b) => cached.days.find((d) => d.date === b.date) ?? b);
    }
  } catch {
    /* cache is best-effort */
  }

  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max,weathercode',
      temperature_unit: 'fahrenheit',
      windspeed_unit: 'mph',
      timezone: 'auto',
      start_date: reqStart,
      end_date: reqEnd,
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return blank;
    const data = (await res.json()) as {
      daily?: {
        time: string[];
        temperature_2m_max: (number | null)[];
        temperature_2m_min: (number | null)[];
        precipitation_probability_max: (number | null)[];
        windspeed_10m_max: (number | null)[];
        weathercode: (number | null)[];
      };
    };
    const d = data.daily;
    if (!d) return blank;
    const days: WeatherDay[] = d.time.map((date, i) => ({
      date,
      tMax: d.temperature_2m_max[i] ?? null,
      tMin: d.temperature_2m_min[i] ?? null,
      precipProb: d.precipitation_probability_max[i] ?? null,
      windMax: d.windspeed_10m_max[i] ?? null,
      code: d.weathercode[i] ?? null,
    }));
    try {
      sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), days }));
    } catch {
      /* best effort */
    }
    return blank.map((b) => days.find((x) => x.date === b.date) ?? b);
  } catch {
    return blank;
  }
}

/** WMO weather code → human label + icon. */
export function weatherLabel(code: number | null): { label: string; icon: string } {
  if (code == null) return { label: 'Forecast not available yet', icon: '🗓️' };
  if (code === 0) return { label: 'Clear', icon: '☀️' };
  if (code <= 2) return { label: 'Partly cloudy', icon: '🌤️' };
  if (code === 3) return { label: 'Overcast', icon: '☁️' };
  if (code <= 48) return { label: 'Fog', icon: '🌫️' };
  if (code <= 57) return { label: 'Drizzle', icon: '🌦️' };
  if (code <= 67) return { label: 'Rain', icon: '🌧️' };
  if (code <= 77) return { label: 'Snow', icon: '🌨️' };
  if (code <= 82) return { label: 'Showers', icon: '🌧️' };
  if (code <= 86) return { label: 'Snow showers', icon: '🌨️' };
  return { label: 'Thunderstorms', icon: '⛈️' };
}
