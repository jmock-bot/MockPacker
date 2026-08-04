import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Icon, type IconName } from './Icon';

/* ---------- Buttons ----------
 * One interaction contract shared by every button in the app:
 *   hover   — lifts (-1px) and deepens by one elevation step
 *   press   — scales to .97, drops elevation (tactile "push")
 *   focus   — 2px accent ring, 2px offset, brand-colored
 *   disabled— 45% opacity, no pointer events, no hover/press
 *   loading — label swapped for a spinner, width locked so nothing reflows
 *   success — brief check-mark confirmation, then back to the label
 * `ghost` and `danger` are retained as aliases so existing call sites keep
 * working; `tertiary` and `destructive` are the names to use going forward.
 */

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'destructive'
  | 'success'
  | 'ghost' // alias → tertiary
  | 'danger'; // alias → destructive

type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    'bg-maroon text-on-accent shadow-e1 hover:bg-maroon-soft hover:shadow-e2 active:bg-maroon-deep active:shadow-none',
  secondary:
    'bg-card text-ink border border-line shadow-e1 hover:border-line-strong hover:shadow-e2 active:bg-cream active:shadow-none',
  tertiary: 'bg-transparent text-ink-soft hover:bg-ink/5 hover:text-ink active:bg-ink/10',
  ghost: 'bg-transparent text-ink-soft hover:bg-ink/5 hover:text-ink active:bg-ink/10',
  // text-on-accent, not text-white: the state tokens flip to LIGHT tints in
  // dark mode, where white text lands at 3.00:1 (danger), 1.94:1 (success) and
  // 2.22:1 (warning) — all failing AA on the app's destructive actions.
  // --color-on-accent already flips to near-black, giving 5.91:1 / 9.17:1.
  destructive: 'bg-danger text-on-accent shadow-e1 hover:shadow-e2 hover:brightness-110 active:brightness-95 active:shadow-none',
  danger: 'bg-danger text-on-accent shadow-e1 hover:shadow-e2 hover:brightness-110 active:brightness-95 active:shadow-none',
  success: 'bg-success text-on-accent shadow-e1 hover:shadow-e2 hover:brightness-110 active:brightness-95 active:shadow-none',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  // 44px floor on every size. `sm` was 34px, which put every compact button in
  // the app under the minimum touch target.
  sm: 'min-h-[44px] px-3 text-caption gap-1.5',
  md: 'min-h-[44px] px-4 text-label gap-2',
  lg: 'min-h-[52px] px-5 text-body gap-2',
};

/** Shared across Button / IconButton / Fab so they feel identical to the touch. */
const INTERACTION =
  'relative inline-flex items-center justify-center font-semibold select-none ' +
  'transition-[background-color,border-color,box-shadow,transform,filter,opacity] ' +
  'duration-reveal ease-press motion-safe-transform ' +
  'hover:-translate-y-px active:translate-y-0 active:scale-[.97] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon focus-visible:ring-offset-2 focus-visible:ring-offset-paper ' +
  'disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none';

/**
 * SVG rather than a bordered box: `border-current/30` is silently dropped by
 * Tailwind (currentColor takes no opacity modifier), which would render a
 * solid ring with no visible rotation. SVG lets the track and the arc carry
 * separate opacities while both inherit the button's text color.
 */
function ButtonSpinner({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`h-4 w-4 animate-spin ${className}`}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  success = false,
  className = '',
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Swaps the label for a spinner and blocks interaction, without collapsing width. */
  loading?: boolean;
  /** Momentary confirmation state — pair with a timeout at the call site. */
  success?: boolean;
}) {
  const busy = loading || success;
  return (
    <button
      {...props}
      disabled={disabled || busy}
      aria-busy={loading || undefined}
      className={`${INTERACTION} ${BUTTON_SIZES[size]} ${BUTTON_STYLES[variant]} rounded-md ${className}`}
    >
      {/* The label stays in flow but goes invisible, so the button keeps its
          exact width while loading — no layout jump on either transition. */}
      <span className={`inline-flex items-center gap-2 ${busy ? 'invisible' : ''}`}>{children}</span>
      {busy && (
        <span className="absolute inset-0 flex items-center justify-center">
          {success ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="m5 12 5 5 9-11"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <ButtonSpinner />
          )}
        </span>
      )}
    </button>
  );
}

/** Square, label-less button. `label` is required — it becomes the aria-label. */
export function IconButton({
  label,
  size = 'md',
  variant = 'tertiary',
  className = '',
  children,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & {
  label: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
}) {
  // Every size clears the 44px touch minimum; `sm` was 36px. The ladder now
  // varies the icon a caller puts inside rather than shrinking the target —
  // the same approach Material takes (48dp target, 24dp glyph).
  const box = size === 'lg' ? 'h-12 w-12' : 'h-11 w-11';
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      className={`${INTERACTION} ${box} ${BUTTON_STYLES[variant]} rounded-md ${className}`}
    >
      {children}
    </button>
  );
}

/** Floating action button — for the one dominant action on a scrolling screen. */
export function Fab({
  label,
  className = '',
  children,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & { label: string }) {
  return (
    <button
      {...props}
      aria-label={label}
      className={`${INTERACTION} h-14 gap-2 rounded-full bg-maroon px-5 text-label text-on-accent shadow-e3 hover:shadow-e3 hover:brightness-105 ${className}`}
    >
      {children}
    </button>
  );
}

/* ---------- Cards ---------- */

export function Card({
  children,
  className = '',
  accent,
  interactive = false,
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  accent?: string;
  /** Adds hover lift + press feedback. Use when the whole card is a target. */
  interactive?: boolean;
  as?: 'section' | 'article' | 'div';
}) {
  return (
    <Tag
      className={`surface-raised rounded-card border border-line bg-card p-5 ${
        interactive
          ? 'motion-safe-transform cursor-pointer transition-[box-shadow,transform,border-color] duration-reveal ease-press hover:-translate-y-0.5 hover:border-line-strong hover:shadow-e2 active:translate-y-0 active:scale-[.99]'
          : ''
      } ${className}`}
      style={accent ? { borderTopColor: accent, borderTopWidth: 3 } : undefined}
    >
      {children}
    </Tag>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-title text-ink">{children}</h2>
      {action}
    </div>
  );
}

/* ---------- Chips ---------- */

/**
 * Chip tones. Each is `bg-<token>/15 text-<token>` — one class pair that works
 * in BOTH themes with no `dark:` variant, because the tokens themselves flip.
 * That is the whole point of having semantic colors: the 21 chips in this app
 * previously carried hand-written light AND dark Tailwind palette classes
 * (a light pair plus a matching `dark:` pair), four values each to keep in
 * sync by hand.
 *
 * Every tone is verified >=4.5:1 against its own tint in both themes.
 * `info` maps to the brand accent rather than introducing a fifth hue —
 * the palette is deliberately one accent plus three states.
 */
export type ChipTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const CHIP_TONES: Record<ChipTone, string> = {
  neutral: 'bg-cream text-ink-soft',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  info: 'bg-maroon/15 text-maroon',
};

export function Chip({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: ChipTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-overline ${CHIP_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Selectable filter chip. Selection springs; the rest is restrained. */
export function FilterChip({
  selected = false,
  count,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      {...props}
      className={`motion-safe-transform inline-flex min-h-[38px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-label transition-[background-color,border-color,color,transform,box-shadow] duration-reveal ease-spring active:scale-[.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon focus-visible:ring-offset-2 focus-visible:ring-offset-paper ${
        selected
          ? 'border-maroon bg-maroon text-on-accent shadow-e1'
          : 'border-line bg-card text-ink-soft hover:border-line-strong hover:text-ink'
      } ${className}`}
    >
      {children}
      {count != null && (
        <span className={`tabular-nums ${selected ? 'opacity-80' : 'text-ink-faint'}`}>{count}</span>
      )}
    </button>
  );
}

/* ---------- Segmented control ---------- */

/** iOS-style segmented control with a sliding indicator. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className = '',
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div
      role="tablist"
      aria-label={label}
      className={`relative flex rounded-md border border-line bg-cream p-1 ${className}`}
    >
      {/* Sliding indicator — one element that moves, rather than each segment
          fading its own background in and out. */}
      <span
        aria-hidden="true"
        className="motion-safe-transform absolute inset-y-1 left-1 z-0 rounded-[calc(var(--radius-md)-4px)] bg-card shadow-e1 transition-transform duration-surface ease-press"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(calc(${index} * 100%))`,
        }}
      />
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={`relative z-10 min-h-[36px] flex-1 rounded-[calc(var(--radius-md)-4px)] px-3 text-label transition-colors duration-reveal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon ${
              on ? 'text-ink' : 'text-ink-faint hover:text-ink-soft'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Skeletons ----------
 * Skeletons mirror the shape of the content they replace, so the page does
 * not reflow when real data lands. Prefer these over a full-page spinner.
 */

export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`block animate-pulse-soft rounded-sm bg-line ${className}`} />;
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <span className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3.5 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </span>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`surface-raised rounded-card border border-line bg-card p-5 ${className}`}>
      <Skeleton className="mb-3 h-4 w-1/3" />
      <SkeletonText lines={3} />
    </div>
  );
}

/** Wrapper that announces loading to assistive tech while skeletons show. */
export function SkeletonScreen({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="flex flex-col gap-4">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/* ---------- Notification banner ---------- */

export function Banner({
  tone = 'info',
  icon,
  children,
  action,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  icon?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  const tones = {
    info: 'border-line bg-card text-ink-soft',
    success: 'border-success/25 bg-success/10 text-success',
    warning: 'border-warning/25 bg-warning/10 text-warning',
    danger: 'border-danger/25 bg-danger/10 text-danger',
  } as const;
  return (
    <div
      role="status"
      className={`flex animate-fade-in items-center gap-3 rounded-md border px-4 py-3 text-body ${tones[tone]}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="min-w-0 flex-1">{children}</span>
      {action && <span className="shrink-0">{action}</span>}
    </div>
  );
}

/* ---------- Collapsible ---------- */

export function Collapsible({
  title,
  defaultOpen = false,
  children,
}: {
  title: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="surface-raised overflow-hidden rounded-card border border-line bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="flex min-h-[52px] w-full items-center justify-between gap-3 px-5 text-left text-title text-ink transition-colors duration-reveal hover:bg-cream/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-maroon"
      >
        {title}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className={`motion-safe-transform shrink-0 text-ink-faint transition-transform duration-surface ease-press ${
            open ? 'rotate-180' : ''
          }`}
        >
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {/* Grid-template-rows 0fr→1fr animates to auto height without JS measurement. */}
      <div
        id={id}
        className={`grid transition-[grid-template-rows,opacity] duration-surface ease-press ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-line px-5 py-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Avatar + presence ---------- */

export function Avatar({
  name,
  color,
  size = 32,
  presence,
}: {
  name: string;
  color: string;
  size?: number;
  presence?: 'online' | 'away' | 'offline';
}) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const dot = { online: 'bg-success', away: 'bg-warning', offline: 'bg-line-strong' };
  return (
    <span className="relative inline-flex shrink-0">
      <span
        aria-hidden="true"
        className="inline-flex items-center justify-center rounded-full font-bold text-white"
        style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.38 }}
      >
        {initials}
      </span>
      {presence && (
        <span
          aria-hidden="true"
          className={`absolute bottom-0 right-0 rounded-full ring-2 ring-paper ${dot[presence]}`}
          style={{ width: Math.max(8, size * 0.28), height: Math.max(8, size * 0.28) }}
        />
      )}
      <span className="sr-only">
        {name}
        {presence ? `, ${presence}` : ''}
      </span>
    </span>
  );
}

/** Overlapping avatar row for "who's on this trip". */
export function AvatarStack({
  people,
  max = 4,
  size = 30,
}: {
  people: { name: string; color: string }[];
  max?: number;
  size?: number;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="flex items-center">
      {shown.map((p, i) => (
        <span key={`${p.name}-${i}`} className="rounded-full ring-2 ring-paper" style={{ marginLeft: i ? -8 : 0 }}>
          <Avatar name={p.name} color={p.color} size={size} />
        </span>
      ))}
      {extra > 0 && (
        <span
          className="inline-flex items-center justify-center rounded-full bg-cream font-bold text-ink-soft ring-2 ring-paper"
          style={{ width: size, height: size, fontSize: size * 0.34, marginLeft: -8 }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}

/* ---------- Form fields ---------- */

export function Field({
  label,
  children,
  hint,
  required,
}: {
  label: string;
  children: (id: string) => ReactNode;
  hint?: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-ink-soft">
        {label}
        {required && <span aria-hidden="true" className="text-danger"> *</span>}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

// border-line-control, not border-line: the field background is only 1.04:1
// against the page, so this border is the sole visual boundary of the control
// and has to clear WCAG 1.4.11's 3:1. Placeholders use ink-soft because
// ink-faint is 4.25:1 on cream-adjacent fills.
// Disabled state matches the button contract (45% opacity, no pointer events)
// so a dead field reads as dead. Without it a disabled input was pixel-identical
// to a live one, and the only feedback was that typing did nothing.
const inputClass =
  'min-h-[44px] w-full rounded-xl border border-line-control bg-card px-3 text-base text-ink placeholder:text-ink-soft ' +
  'focus:border-maroon focus:outline-none focus:ring-2 focus:ring-maroon/15 ' +
  'disabled:cursor-not-allowed disabled:opacity-45 disabled:bg-cream';

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

/** Price input — opens the numeric keyboard on iPhone. */
export function MoneyInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder="0.00"
      {...props}
      className={`${inputClass} ${props.className ?? ''}`}
    />
  );
}

export function QtyInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      {...props}
      className={`${inputClass} ${props.className ?? ''}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`${inputClass} appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%228%22><path d=%22M1 1l5 5 5-5%22 stroke=%22%237c7681%22 stroke-width=%222%22 fill=%22none%22 stroke-linecap=%22round%22/></svg>')] bg-[position:right_0.9rem_center] bg-no-repeat pr-9 ${props.className ?? ''}`}
    />
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      {...props}
      className={`w-full rounded-xl border border-line-control bg-card px-3 py-2 text-base text-ink placeholder:text-ink-soft focus:border-maroon focus:outline-none focus:ring-2 focus:ring-maroon/15 ${props.className ?? ''}`}
    />
  );
}

/* ---------- Stepper for quantities (large touch targets) ---------- */

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 99,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  return (
    <div className="inline-flex items-center gap-1" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-card text-xl font-bold text-ink active:bg-paper"
      >
        −
      </button>
      <span className="min-w-[2.5rem] text-center text-lg font-bold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-card text-xl font-bold text-ink active:bg-paper"
      >
        +
      </button>
    </div>
  );
}

/* ---------- Progress bar ---------- */

export function ProgressBar({
  value,
  color,
  label,
}: {
  value: number;
  color?: string;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? 'Progress'}
      className="h-2.5 w-full overflow-hidden rounded-full bg-line"
    >
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${clamped}%`, backgroundColor: color ?? 'rgb(var(--color-accent))' }}
      />
    </div>
  );
}

/* ---------- Readiness ring ---------- */

export function ReadinessRing({ value, size = 96 }: { value: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  // Reference the semantic CSS variables so the ring recolors in dark mode.
  const tone =
    clamped >= 80
      ? 'rgb(var(--color-success))'
      : clamped >= 50
        ? 'rgb(var(--color-warning))'
        : 'rgb(var(--color-danger))';
  return (
    <div
      role="img"
      aria-label={`Trip readiness ${Math.round(clamped)} percent`}
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--color-border))" strokeWidth="8" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped / 100)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute text-lg font-bold tabular-nums" style={{ color: tone }}>
        {Math.round(clamped)}%
      </span>
    </div>
  );
}

/* ---------- Modal (accessible) ---------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // `mounted` keeps the dialog in the DOM through its exit animation;
  // `shown` drives the transform/opacity. Exits run faster than entrances —
  // a slow dismissal feels unresponsive.
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Next frame, so the browser paints the "from" state before transitioning.
      const raf = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), 180);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Focus the dialog itself so screen readers announce the title.
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const focusables = ref.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const firstEl = focusables[0];
        const lastEl = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!mounted) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity ease-press ${
          shown ? 'opacity-100 duration-surface' : 'opacity-0 duration-reveal'
        }`}
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`surface-floating motion-safe-transform relative z-10 max-h-[92dvh] w-full overflow-y-auto rounded-t-xl bg-paper p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] outline-none transition-[transform,opacity] sm:rounded-xl ${
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'
        } ${
          shown
            ? 'translate-y-0 opacity-100 duration-surface ease-decelerate sm:scale-100'
            : 'translate-y-full opacity-0 duration-reveal ease-accelerate sm:translate-y-0 sm:scale-[.97]'
        }`}
      >
        {/* Grab handle — signals "this is a sheet you can dismiss" on mobile. */}
        <div aria-hidden="true" className="mx-auto mb-3 h-1 w-9 rounded-full bg-line-strong sm:hidden" />
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-title-lg text-ink">
            {title}
          </h2>
          <IconButton label="Close dialog" onClick={onClose} className="-mr-1 shrink-0">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Confirm dialog (destructive actions) ---------- */

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = 'Delete',
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body?: string;
  confirmLabel?: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {body && <p className="mb-4 text-sm text-ink-soft">{body}</p>}
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          className="flex-1"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

/* ---------- Empty state ---------- */

/**
 * Empty states get real presence rather than a dashed outline — a dashed box
 * reads as "unfinished form field", not "nothing here yet". The icon sits in
 * a soft tinted halo so the block has a focal point.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: IconName;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface-raised flex animate-fade-in flex-col items-center gap-3 rounded-card border border-line bg-card px-6 py-12 text-center">
      {icon && (
        <span className="relative flex h-16 w-16 items-center justify-center">
          <span aria-hidden="true" className="absolute inset-0 rounded-full bg-maroon-tint" />
          <span aria-hidden="true" className="absolute inset-2 rounded-full bg-maroon/10" />
          <Icon name={icon} size={28} className="relative text-maroon" />
        </span>
      )}
      <p className="text-title-lg text-ink">{title}</p>
      {body && <p className="max-w-sm text-body text-ink-soft">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ---------- Inline warning ---------- */

export function Warning({ children, tone = 'amber' }: { children: ReactNode; tone?: 'amber' | 'rose' }) {
  // Semantic tokens rather than raw Tailwind palettes, so these track the
  // brand and flip correctly in dark mode.
  const styles =
    tone === 'rose'
      ? 'border-danger/25 bg-danger/10 text-danger'
      : 'border-warning/25 bg-warning/10 text-warning';
  return (
    <div role="status" className={`animate-fade-in rounded-md border px-3.5 py-2.5 text-body ${styles}`}>
      {children}
    </div>
  );
}

/* ---------- Loading ---------- */

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-ink-faint" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-maroon" aria-hidden="true" />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

/* ---------- Stat tile ---------- */

export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'good' | 'bad' | 'neutral';
}) {
  const valueColor = tone === 'bad' ? 'text-danger' : tone === 'good' ? 'text-success' : 'text-ink';
  return (
    <div className="surface-raised rounded-card border border-line bg-card p-4">
      <p className="text-overline uppercase text-ink-faint">{label}</p>
      <p className={`mt-1.5 text-title-lg tabular-nums ${valueColor}`}>{value}</p>
      {sub && <p className="mt-0.5 text-caption text-ink-faint">{sub}</p>}
    </div>
  );
}
