import type { ReactNode, SVGProps } from 'react';

/**
 * Lightweight stroked icon set (Lucide-style). Single component, inline SVG
 * paths sharing one stroke style so icons recolor via `currentColor` and match
 * the app's typographic weight. This replaces the previous emoji icon system.
 */
export type IconName =
  | 'home'
  | 'compass'
  | 'checklist'
  | 'calendar'
  | 'calendar-empty'
  | 'users'
  | 'bag'
  | 'search'
  | 'truck'
  | 'user'
  | 'plus'
  | 'sparkle'
  | 'bell'
  | 'camera'
  | 'comment'
  | 'shirt'
  | 'cart'
  | 'palette'
  | 'package'
  | 'alert'
  | 'x'
  | 'chevron-right'
  | 'sun'
  | 'moon'
  | 'plane'
  | 'droplet'
  | 'wind'
  | 'heart'
  | 'fire'
  | 'laugh'
  | 'thumbs-up'
  | 'image'
  | 'check'
  | 'star'
  | 'edit'
  | 'file'
  | 'trash'
  | 'lock'
  | 'party'
  | 'target'
  | 'cloud'
  | 'mail'
  | 'vote'
  | 'menu'
  | 'logout'
  | 'clock'
  | 'pin'
  | 'briefcase'
  | 'send';

const PATHS: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </>
  ),
  checklist: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    </>
  ),
  'calendar-empty': (
    <>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2" />
      <path d="M8 2.5v4M16 2.5v4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20v-1.5A4.5 4.5 0 0 1 7 14h4a4.5 4.5 0 0 1 4.5 4.5V20" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a4.5 4.5 0 0 1 3.5 4.4V20" />
    </>
  ),
  bag: (
    <>
      <path d="M6 9.5a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4V18a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" />
      <path d="M9.5 5.5V4.5a2.5 2.5 0 0 1 5 0v1" />
      <path d="M9 12h6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  truck: (
    <>
      <path d="M3 6h11v9H3z" />
      <path d="M14 9h3.5L21 12.5V15h-7z" />
      <circle cx="7" cy="18" r="1.8" />
      <circle cx="17" cy="18" r="1.8" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5v-1a6 6 0 0 1 6-6h3a6 6 0 0 1 6 6v1" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  sparkle: (
    <path d="M12 3l1.9 5.6a2 2 0 0 0 1.5 1.5L21 12l-5.6 1.9a2 2 0 0 0-1.5 1.5L12 21l-1.9-5.6a2 2 0 0 0-1.5-1.5L3 12l5.6-1.9a2 2 0 0 0 1.5-1.5z" />
  ),
  bell: (
    <>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
      <path d="M10.3 19.5a1.8 1.8 0 0 0 3.4 0" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  comment: (
    <path d="M20 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
  ),
  shirt: (
    <>
      <path d="M8 3 3.5 6l2 3 2-1.2V21h9V7.8l2 1.2 2-3L16 3l-2 2a2.8 2.8 0 0 1-4 0z" />
    </>
  ),
  cart: (
    <>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="17" cy="20" r="1.5" />
      <path d="M3 4h2l2.4 12h11l1.8-8H6.2" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-1 1.6-2 0-1.6 1.1-2 2.6-2h1A3.8 3.8 0 0 0 21 11.5 9 9 0 0 0 12 3z" />
      <circle cx="7.5" cy="11" r="1" />
      <circle cx="11" cy="7.5" r="1" />
      <circle cx="16" cy="9.5" r="1" />
    </>
  ),
  package: (
    <>
      <path d="M21 8 12 3 3 8v8l9 5 9-5z" />
      <path d="M3 8l9 5 9-5M12 13v8" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 2 20h20z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  x: <path d="M5 5l14 14M19 5 5 19" />,
  'chevron-right': <path d="m9 6 6 6-6 6" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </>
  ),
  moon: <path d="M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5z" />,
  plane: (
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
  ),
  droplet: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  wind: (
    <path d="M3 8h9a3 3 0 1 0-3-3M3 12h14a3 3 0 1 1-3 3M3 16h7a2.5 2.5 0 1 1-2.5 2.5" />
  ),
  heart: (
    <path d="M12 20s-7-4.5-9.5-9A5 5 0 0 1 12 5a5 5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" />
  ),
  fire: (
    <path d="M12 3c1 2.6-1.4 4.3-1.4 6.8a2.8 2.8 0 0 0 5.6 0c0-.8.3-1.3.3-1.3.9 1 2.4 3.1 2.4 5.2a6.9 6.9 0 0 1-13.8 0c0-3.4 3-4.8 4-6.9.5-1 2.9-2 2.9-3.8z" />
  ),
  laugh: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14a4 4 0 0 0 8 0z" />
      <path d="M9 9h.01M15 9h.01" />
    </>
  ),
  'thumbs-up': (
    <>
      <path d="M7 11v9H4v-9z" />
      <path d="M7 11l3.5-7.5A2 2 0 0 1 13 5v4h5.5a2 2 0 0 1 2 2.3l-1 6A2 2 0 0 1 17.5 20H7" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m3 17 5-5 4 4 3-3 6 6" />
    </>
  ),
  check: <path d="m5 12 5 5 9-11" />,
  star: (
    <path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.9L12 16.9 6.8 19.5l1-5.9-4.3-4.1 5.9-.9z" />
  ),
  edit: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="m13 7 4 4" />
    </>
  ),
  file: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  party: (
    <>
      <path d="M3 21 8.5 8l7.5 7.5z" />
      <path d="M14 3s.5 2 2.5 2.5M18 7s2 .5 2.5 2.5M13 8l1.5-1.5M19 13l1.5-1.5" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.5" />
    </>
  ),
  cloud: (
    <path d="M6.5 18a4 4 0 0 1 .3-8 5 5 0 0 1 9.4-1.2A3.6 3.6 0 0 1 17.5 18z" />
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
  vote: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m8 12 2.5 2.5L16 9" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  logout: (
    <>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 12h10M17 9l3 3-3 3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7" />
    </>
  ),
  send: <path d="M4 12h16M14 6l6 6-6 6" />,
};

export function Icon({
  name,
  size = 24,
  className = '',
  ...rest
}: {
  name: IconName;
  size?: number;
  className?: string;
} & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
