/**
 * Heuristic extraction for "create a trip from a group chat": pasted chat
 * text in, a best-guess trip skeleton out. Deterministic regex/keyword
 * matching only — no external API — so results are previewed as editable
 * fields in ImportChatModal rather than presented as certain.
 */

export interface ParsedChatImport {
  suggestedName: string;
  city: string;
  startDate: string | null;
  endDate: string | null;
  travelers: string[];
  detectedActivities: { label: string; kind: string }[];
}

const MONTHS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];

const iso = (y: number, mIdx: number, d: number): string =>
  `${y}-${String(mIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Nearest occurrence of month/day that isn't in the past (trips are upcoming). */
function resolveYear(monthIdx: number, day: number, today: Date): number {
  const year = today.getFullYear();
  const candidate = new Date(year, monthIdx, day);
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return candidate < cutoff ? year + 1 : year;
}

const MONTH_RE = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';
const DATE_RANGE_RE = new RegExp(
  `\\b${MONTH_RE}\\s+(\\d{1,2})(?:\\s*(?:st|nd|rd|th)?\\s*(?:–|—|-|to|through)\\s*(?:${MONTH_RE}\\s+)?(\\d{1,2}))?`,
  'i'
);

function extractDates(text: string, today = new Date()): { startDate: string | null; endDate: string | null } {
  const m = text.match(DATE_RANGE_RE);
  if (!m) return { startDate: null, endDate: null };
  // Group 1 = start month, 2 = start day, 3 = optional cross-month end month, 4 = optional end day.
  const startMonthIdx = MONTHS.indexOf(m[1].toLowerCase());
  const startDay = parseInt(m[2], 10);
  if (startMonthIdx < 0 || !startDay) return { startDate: null, endDate: null };
  const endMonthIdx = m[3] ? MONTHS.indexOf(m[3].toLowerCase()) : startMonthIdx;
  const endDay = m[4] ? parseInt(m[4], 10) : startDay;

  const startYear = resolveYear(startMonthIdx, startDay, today);
  const endYear = endMonthIdx < startMonthIdx ? startYear + 1 : startYear;

  return {
    startDate: iso(startYear, startMonthIdx, startDay),
    endDate: iso(endYear, endMonthIdx, endDay),
  };
}

// "day trip to" is deliberately excluded — that phrase feeds extractActivities
// instead (e.g. "Sintra day trip"), not the main destination.
const DESTINATION_TRIGGERS = ['heading to', 'going to', 'trip to', 'flying to', 'doing', 'in'];

/** Multi-word captures can run into a trailing date ("Lisbon Aug") — drop it. */
function trimTrailingMonth(candidate: string): string {
  const words = candidate.split(/\s+/);
  while (words.length > 1 && MONTHS.some((mo) => words[words.length - 1].toLowerCase().startsWith(mo))) {
    words.pop();
  }
  return words.join(' ');
}

function extractCity(text: string): string {
  for (const trigger of DESTINATION_TRIGGERS) {
    // Negative lookbehind keeps "trip to" from also matching inside "day trip to".
    const re = new RegExp(`(?<!day )\\b${trigger}\\s+([A-Z][a-zA-Z']+(?:\\s[A-Z][a-zA-Z']+){0,2})`, 'g');
    for (const m of text.matchAll(re)) {
      const candidate = trimTrailingMonth(m[1].trim());
      const lower = candidate.toLowerCase();
      if (MONTHS.some((mo) => lower.startsWith(mo))) continue; // e.g. "in August"
      if (['I', 'We', 'You', 'The'].includes(candidate)) continue;
      return candidate;
    }
  }
  return '';
}

const SENDER_RE = /^([A-Z][A-Za-z'.-]{1,20}):\s*(.+)$/;
const NON_NAME_SENDERS = new Set(['ok', 'yes', 'no', 'note', 'system', 'update']);

function extractTravelers(lines: string[]): string[] {
  const seen: string[] = [];
  for (const line of lines) {
    const m = line.match(SENDER_RE);
    if (!m) continue;
    const name = m[1].trim();
    if (NON_NAME_SENDERS.has(name.toLowerCase())) continue;
    if (!seen.some((n) => n.toLowerCase() === name.toLowerCase())) seen.push(name);
    if (seen.length >= 10) break;
  }
  return seen;
}

interface ActivityRule {
  test: RegExp;
  kind: string;
  label: string | ((match: RegExpMatchArray) => string);
}

const ACTIVITY_RULES: ActivityRule[] = [
  { test: /day trip to ([A-Z][a-zA-Z']+)/, kind: 'sightseeing', label: (m) => `${m[1]} day trip` },
  { test: /\bsnorkel/i, kind: 'beach', label: 'Snorkeling' },
  { test: /\bdiving\b|\bscuba\b/i, kind: 'beach', label: 'Diving' },
  { test: /\bhik(e|ing)\b/i, kind: 'hiking', label: 'Hiking' },
  { test: /\bski(ing)?\b/i, kind: 'skiing', label: 'Skiing' },
  { test: /\bbeach\b/i, kind: 'beach', label: 'Beach day' },
  { test: /\bpool\b/i, kind: 'pool', label: 'Pool' },
  { test: /\bgolf/i, kind: 'golf', label: 'Golf' },
  { test: /\bcamp(ing)?\b/i, kind: 'camping', label: 'Camping' },
  { test: /\bwedding\b/i, kind: 'wedding', label: 'Wedding' },
  { test: /\bformal dinner\b|\bfancy dinner\b/i, kind: 'formal_dinner', label: 'Formal dinner' },
  { test: /\bconcert\b/i, kind: 'concert', label: 'Concert' },
  { test: /\bmuseum\b|\bsightsee/i, kind: 'sightseeing', label: 'Sightseeing' },
  { test: /\bshopping\b/i, kind: 'shopping', label: 'Shopping' },
  { test: /\btheme park\b/i, kind: 'theme_park', label: 'Theme park' },
  { test: /\bkayak/i, kind: 'outdoor', label: 'Kayaking' },
];

function extractActivities(text: string): { label: string; kind: string }[] {
  const out: { label: string; kind: string }[] = [];
  for (const rule of ACTIVITY_RULES) {
    const m = text.match(rule.test);
    if (!m) continue;
    const label = typeof rule.label === 'function' ? rule.label(m) : rule.label;
    if (!out.some((a) => a.label === label)) out.push({ label, kind: rule.kind });
    if (out.length >= 4) break;
  }
  return out;
}

export interface ParsedChatLine {
  sender: string | null;
  body: string;
}

/** Line-by-line split used to seed chat_messages after an import — preserves
 * the original text and order, whether or not a line matches "Name: text". */
export function splitChatLines(raw: string): ParsedChatLine[] {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(SENDER_RE);
      if (m && !NON_NAME_SENDERS.has(m[1].toLowerCase())) return { sender: m[1].trim(), body: m[2].trim() };
      return { sender: null, body: line };
    });
}

export function parseChatImport(raw: string, today = new Date()): ParsedChatImport {
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const text = lines.join(' ');

  const { startDate, endDate } = extractDates(text, today);
  const city = extractCity(text);
  const travelers = extractTravelers(lines);
  const detectedActivities = extractActivities(text);

  return {
    suggestedName: city ? `${city} Getaway` : 'Imported Trip',
    city,
    startDate,
    endDate,
    travelers,
    detectedActivities,
  };
}

export const EXAMPLE_CHAT_TEXT = `Maya: ok so are we doing Lisbon Aug 14–20??
Jon: yes!! I already found a flight
Priya: I want to do the day trip to Sintra
Maya: + we need snorkel gear for the coast day`;
