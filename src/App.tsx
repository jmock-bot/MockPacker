import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TripProvider } from './context/TripContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { Layout } from './components/Layout';
import { ScrollRestoration } from './components/ScrollRestoration';
import { Spinner } from './components/ui';
import { supabaseConfigured } from './lib/supabase';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { TripsPage } from './pages/TripsPage';
import { NewTripPage } from './pages/NewTripPage';
import { PackingPage } from './pages/PackingPage';
import { DaysPage, DayDetailPage } from './pages/DaysPage';
import { GroupPage } from './pages/GroupPage';
import { BagPage } from './pages/BagPage';
import { SearchPage } from './pages/SearchPage';
import { ShipmentsPage } from './pages/ShipmentsPage';
import { ProfilePage } from './pages/ProfilePage';
import { JoinPage } from './pages/JoinPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner label="Getting your trips ready" />;
  if (!session)
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

function SetupHelp() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
      <span aria-hidden="true" className="text-4xl">🎒</span>
      <h1 className="text-xl font-bold text-maroon">MockPacker needs a database</h1>
      <p className="text-sm text-ink-soft">
        Supabase environment variables are missing. Copy <code>.env.example</code> to{' '}
        <code>.env</code>, fill in <code>VITE_SUPABASE_URL</code> and{' '}
        <code>VITE_SUPABASE_ANON_KEY</code>, run the SQL migrations in{' '}
        <code>supabase/migrations/</code>, and restart the dev server. Details in the README.
      </p>
    </div>
  );
}

export default function App() {
  if (!supabaseConfigured)
    return (
      <ThemeProvider>
        <SetupHelp />
      </ThemeProvider>
    );
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
        <ToastProvider>
          <TripProvider>
            <ScrollRestoration />
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/join/:code?"
                element={
                  <RequireAuth>
                    <JoinPage />
                  </RequireAuth>
                }
              />
              <Route
                element={
                  <RequireAuth>
                    <Layout />
                  </RequireAuth>
                }
              >
                <Route path="/" element={<HomePage />} />
                <Route path="/trips" element={<TripsPage />} />
                <Route path="/trips/new" element={<NewTripPage />} />
                <Route path="/packing" element={<PackingPage />} />
                <Route path="/days" element={<DaysPage />} />
                <Route path="/days/:date" element={<DayDetailPage />} />
                <Route path="/group" element={<GroupPage />} />
                <Route path="/bag" element={<BagPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/shipments" element={<ShipmentsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </TripProvider>
        </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
