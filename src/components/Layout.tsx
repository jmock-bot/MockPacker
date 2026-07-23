import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTrip } from '../context/TripContext';
import { useTheme } from '../context/ThemeContext';
import { Modal } from './ui';
import { Icon, type IconName } from './Icon';
import { InstallPrompt } from './InstallPrompt';
import { timeAgo } from '../lib/format';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
}

const SIDEBAR_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/trips', label: 'Trips', icon: 'compass' },
  { to: '/packing', label: 'Packing', icon: 'checklist' },
  { to: '/days', label: 'Daily Plans', icon: 'calendar' },
  { to: '/group', label: 'Group', icon: 'users' },
  { to: '/bag', label: 'Bag', icon: 'bag' },
  { to: '/search', label: 'Shop', icon: 'search' },
  { to: '/shipments', label: 'Shipments', icon: 'truck' },
  { to: '/profile', label: 'Profile', icon: 'user' },
];

// Four primary destinations for the mobile tab bar; the rest live in "More".
const MOBILE_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/days', label: 'Days', icon: 'calendar' },
  { to: '/bag', label: 'Bag', icon: 'bag' },
  { to: '/group', label: 'Group', icon: 'users' },
];

const MORE_ITEMS: NavItem[] = [
  { to: '/trips', label: 'Trips', icon: 'compass' },
  { to: '/packing', label: 'Packing', icon: 'checklist' },
  { to: '/search', label: 'Shop', icon: 'search' },
  { to: '/shipments', label: 'Shipments', icon: 'truck' },
  { to: '/profile', label: 'Profile', icon: 'user' },
];

export function Layout() {
  const { profile, signOut } = useAuth();
  const {
    activeTrip,
    offline,
    notifications,
    unreadNotifications,
    markNotificationRead,
    markAllNotificationsRead,
  } = useTrip();
  const navigate = useNavigate();
  const { setTheme } = useTheme();
  const [notifOpen, setNotifOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const doSignOut = () => {
    void signOut().then(() => navigate('/login'));
  };

  // Quick binary flip from the header: toggle relative to the currently
  // rendered mode (the .dark class ThemeContext stamps on <html>), and persist
  // the result as an explicit light/dark choice. The Settings screen keeps the
  // full light/dark/system control.
  const toggleTheme = () => {
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <div className="min-h-dvh bg-paper lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-line bg-card lg:flex lg:flex-col">
        <div className="border-b border-line p-4">
          <div className="flex items-center gap-2.5">
            <img src="/icons/icon-192.png" alt="" width={34} height={34} className="h-[34px] w-[34px] rounded-lg" />
            <div>
              <p className="text-sm font-bold text-maroon">MockPacker</p>
              <p className="text-xs text-ink-faint">Pack together. Travel ready.</p>
            </div>
          </div>
        </div>
        <nav aria-label="Main" className="flex-1 space-y-1 overflow-y-auto p-3">
          {SIDEBAR_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium ${
                  isActive ? 'bg-maroon text-on-accent' : 'text-ink-soft hover:bg-paper'
                }`
              }
            >
              <Icon name={item.icon} size={20} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line p-3">
          <button
            type="button"
            onClick={() => setNotifOpen(true)}
            className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-ink-soft hover:bg-paper"
          >
            <Icon name="bell" size={20} /> Notifications
            {unreadNotifications > 0 && (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-maroon px-1.5 text-[10px] font-bold text-on-accent">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </button>
          <p className="truncate px-3 pt-1 text-xs text-ink-faint">{profile?.display_name || 'Traveler'}</p>
          <button
            type="button"
            onClick={doSignOut}
            className="mt-1 flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-ink-soft hover:bg-paper"
          >
            <Icon name="logout" size={20} /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-paper/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur lg:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <img src="/icons/icon-192.png" alt="" width={26} height={26} className="h-[26px] w-[26px] rounded-md" />
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight text-maroon">MockPacker</p>
              {activeTrip && (
                <p className="truncate text-[11px] leading-tight text-ink-faint">{activeTrip.name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
              className="theme-toggle flex h-11 w-11 items-center justify-center rounded-xl text-ink-soft hover:bg-ink/5"
            >
              <Icon name="sun" size={20} className="hidden dark:block" />
              <Icon name="moon" size={20} className="block dark:hidden" />
            </button>
            <button
              type="button"
              onClick={() => setNotifOpen(true)}
              aria-label={`Notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ''}`}
              className="relative flex h-11 w-11 items-center justify-center rounded-xl text-ink-soft hover:bg-ink/5"
            >
              <Icon name="bell" size={20} />
              {unreadNotifications > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-maroon px-1 text-[10px] font-bold text-on-accent">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </button>
          </div>
        </header>

        {activeTrip?.is_demo && (
          <div role="status" className="flex items-center justify-center gap-2 bg-maroon px-4 py-2 text-center text-xs font-semibold text-on-accent">
            <Icon name="sparkle" size={16} /> Demo trip — sample data so you can explore. Delete it anytime from Trips.
          </div>
        )}

        {offline && (
          <div role="status" className="bg-amber-100 px-4 py-2 text-center text-xs font-semibold text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
            You're offline — showing the latest saved data.
          </div>
        )}

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-4 lg:pb-8">
          <Outlet />
        </main>

        <InstallPrompt />

        {/* Mobile bottom navigation — 4 primary tabs + More */}
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          <div className="mx-auto flex max-w-lg items-stretch justify-around">
            {MOBILE_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex min-h-[56px] min-w-[60px] flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium ${
                    isActive ? 'text-maroon' : 'text-ink-faint'
                  }`
                }
              >
                <Icon name={item.icon} size={22} />
                {item.label}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="flex min-h-[56px] min-w-[60px] flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium text-ink-faint"
            >
              <Icon name="menu" size={22} />
              More
            </button>
          </div>
        </nav>
      </div>

      {/* "More" sheet (mobile) */}
      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <nav aria-label="More" className="flex flex-col gap-1">
          {MORE_ITEMS.map((item) => (
            <button
              key={item.to}
              type="button"
              onClick={() => {
                setMoreOpen(false);
                navigate(item.to);
              }}
              className="flex min-h-[48px] items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-ink-soft hover:bg-cream"
            >
              <Icon name={item.icon} size={20} />
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setMoreOpen(false);
              doSignOut();
            }}
            className="flex min-h-[48px] items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-ink-soft hover:bg-cream"
          >
            <Icon name="logout" size={20} /> Sign out
          </button>
        </nav>
      </Modal>

      {/* Notifications */}
      <Modal open={notifOpen} onClose={() => setNotifOpen(false)} title="Notifications">
        {notifications.length === 0 ? (
          <p className="text-sm text-ink-faint">
            Nothing yet — you'll see trip invitations, assignments, shipping updates, and packing
            reminders here.
          </p>
        ) : (
          <>
            {unreadNotifications > 0 && (
              <button
                type="button"
                onClick={() => void markAllNotificationsRead()}
                className="mb-3 text-xs font-semibold text-ink-soft underline underline-offset-2"
              >
                Mark all as read
              </button>
            )}
            <ul className="divide-y divide-line">
              {notifications.slice(0, 30).map((n) => (
                <li key={n.id} className="py-2.5">
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => {
                      if (!n.read_at) void markNotificationRead(n.id);
                      setNotifOpen(false);
                    }}
                  >
                    <p className={`text-sm ${n.read_at ? 'text-ink-faint' : 'font-semibold text-ink'}`}>
                      {n.title}
                    </p>
                    {n.body && <p className="text-xs text-ink-faint">{n.body}</p>}
                    <p className="mt-0.5 text-[11px] text-ink-faint">{timeAgo(n.created_at)}</p>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Modal>
    </div>
  );
}
