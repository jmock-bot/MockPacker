import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const KEY = 'mp-scroll-positions';

function load(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

/**
 * Remembers scroll position per route and restores it on back/forward
 * navigation, so returning to a long packing list (or reopening the installed
 * PWA) lands where the user left off. New forward navigations scroll to top.
 */
export function ScrollRestoration() {
  const location = useLocation();
  const navType = useNavigationType();
  const positions = useRef<Record<string, number>>(load());

  useEffect(() => {
    const key = location.pathname + location.search;
    if (navType === 'POP' && positions.current[key] != null) {
      requestAnimationFrame(() => window.scrollTo(0, positions.current[key]));
    } else {
      window.scrollTo(0, 0);
    }
    const save = () => {
      positions.current[key] = window.scrollY;
      try {
        sessionStorage.setItem(KEY, JSON.stringify(positions.current));
      } catch {
        /* best effort */
      }
    };
    window.addEventListener('pagehide', save);
    return () => {
      save();
      window.removeEventListener('pagehide', save);
    };
  }, [location, navType]);

  return null;
}
