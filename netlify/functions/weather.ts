/**
 * GET /api/weather?lat=…&lon=…&start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Optional server-side weather proxy. The app's default provider is
 * Open-Meteo, which is keyless and is called directly from the client
 * (src/lib/weather.ts). This function exists as the integration point for a
 * keyed provider (e.g. OpenWeather via OPENWEATHER_API_KEY) so that if you
 * switch, the key stays server-side. It mirrors Open-Meteo's daily shape so
 * the client can swap endpoints without changes.
 */
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=1800' },
  });

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));
  const start = url.searchParams.get('start') ?? '';
  const end = url.searchParams.get('end') ?? '';
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return json({ ok: false, error: 'lat, lon, start, end are required.' }, 400);
  }

  // If a keyed provider is configured, use it here (key stays server-side).
  // if (process.env.OPENWEATHER_API_KEY) { …call OpenWeather One Call… }

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max,weathercode',
    temperature_unit: 'fahrenheit',
    windspeed_unit: 'mph',
    timezone: 'auto',
    start_date: start,
    end_date: end,
  });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return json({ ok: false, error: 'Weather provider error.' }, 502);
    return json({ ok: true, data: await res.json() });
  } catch {
    return json({ ok: false, error: 'Weather provider did not respond.' }, 504);
  }
}
