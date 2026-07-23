import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTrip } from '../context/TripContext';
import { Modal } from './ui';
import { InstallPrompt } from './InstallPrompt';
import { timeAgo } from '../lib/format';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const SIDEBAR_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/trips', label: 'Trips', icon: '🧳' },
  { to: '/packing', label: 'Packing', icon: '✅' },
  { to: '/days', label: 'Daily Plans', icon: '📅' },
  { to: '/group', label: 'Group', icon: '👥' },
  { to: '/bag', label: 'Bag', icon: '🎒' },
  { to: '/search', label: 'Shop', icon: '🔍' },
  { to: '/shipments', label: 'Shipments', icon: '🚚' },
  { to: '/profile', label: 'Profile', icon: '👤' },
];

const MOBILE_ITEMS: NavItem[] = [
  { to: '/', label: 'Trip', icon: '🧳' },
  { to: '/packing', label: 'Pack', icon: '✅' },
  { to: '/days', label: 'Today', icon: '📅' },
  { to: '/bag', label: 'Bag', icon: '🎒' },
];

const MORE_ITEMS: NavItem[] = [
  { to: '/trips', label: 'All trips', icon: '🧳' },
  { to: '/group', label: 'Group & themes', icon: '👥' },
  { to: '/search', label: 'Shop for items', icon: '🔍' },
  { to: '/shipments', label: 'Shipments', icon: '🚚' },
  { to: '/profile', label: 'Profile & sizes', icon: '👤' },
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
  const [notifOpen, setNotifOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const doSignOut = () => {
    void signOut().then(() => navigate('/login'));
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
              <span aria-hidden="true">{item.icon}</span>
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
            <span aria-hidden="true">🔔</span> Notifications
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
            <span aria-hidden="true">🚪</span> Sign out
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
          <button
            type="button"
            onClick={() => setNotifOpen(true)}
            aria-label={`Notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ''}`}
            className="relative flex h-11 w-11 items-center justify-center rounded-xl text-lg"
          >
            <span aria-hidden="true">🔔</span>
            {unreadNotifications > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-maroon px-1 text-[10px] font-bold text-on-accent">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </button>
        </header>

        {activeTrip?.is_demo && (
          <div role="status" className="bg-maroon px-4 py-2 text-center text-xs font-semibold text-on-accent">
            ✨ Demo trip — sample data so you can explore. Delete it anytime from Trips.
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

        {/* Mobile bottom navigation */}
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
                {({ isActive }) => (
                  <>
                    <span aria-hidden="true" className={`text-lg ${isActive ? '' : 'grayscale opacity-70'}`}>
                      {item.icon}
                    </span>
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="flex min-h-[56px] min-w-[60px] flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium text-ink-faint"
            >
              <span aria-hidden="true" className="text-lg grayscale opacity-70">☰</span>
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
              <span aria-hidden="true">{item.icon}</span>
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
            <span aria-hidden="true">🚪</span> Sign out
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
