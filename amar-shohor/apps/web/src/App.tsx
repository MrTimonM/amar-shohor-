import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { EmptyState } from './components/ui';
import { useAuth } from './lib/auth-context';
import { useUi } from './lib/ui-context';

import { MapPage } from './pages/MapPage';
import { IssuePage } from './pages/IssuePage';
import { ReportPage } from './pages/ReportPage';
import { MyReportsPage } from './pages/MyReportsPage';
import { DashboardPage } from './pages/DashboardPage';
import { QueuePage } from './pages/QueuePage';
import { ReviewPage } from './pages/ReviewPage';
import { SignInPage } from './pages/SignInPage';
import { HomePage } from './pages/HomePage';
import { AdminPage } from './pages/AdminPage';

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/issue/:id" element={<IssuePage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/mine" element={<RequireUser><MyReportsPage /></RequireUser>} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/queue" element={<RequireStaff><QueuePage /></RequireStaff>} />
        <Route path="/review" element={<RequireStaff><ReviewPage /></RequireStaff>} />
        <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
        <Route path="/signin" element={<SignInPage />} />
        {/* The old link shape, kept so a bookmarked /signup still lands right. */}
        <Route path="/signup" element={<Navigate to="/signin?mode=signup" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppShell>
  );
}

function RequireUser({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/signin" replace />;
  return <>{children}</>;
}

function RequireStaff({ children }: { children: React.ReactNode }) {
  const { user, loading, isStaff } = useAuth();
  const { t } = useUi();
  if (loading) return null;
  if (!user) return <Navigate to="/signin" replace />;
  if (!isStaff) {
    return (
      <EmptyState icon="shield" title={t({ en: 'Authority access only', bn: 'শুধু কর্তৃপক্ষের জন্য' })}>
        {t({
          en: 'This section belongs to the city departments. Everything the public can see is on the map and the dashboard.',
          bn: 'এই অংশটি সিটি কর্পোরেশনের বিভাগগুলোর জন্য। জনগণের জন্য সব তথ্য মানচিত্র ও ড্যাশবোর্ডে আছে।',
        })}
      </EmptyState>
    );
  }
  return <>{children}</>;
}

/**
 * Admin is its own guard rather than a flag on RequireStaff: an authority
 * staffer should be told this section exists and is not theirs, not shown a
 * blank page.
 */
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useUi();
  if (loading) return null;
  if (!user) return <Navigate to="/signin" replace />;
  if (user.role !== 'admin') {
    return (
      <EmptyState icon="shield" title={t({ en: 'Administrators only', bn: 'শুধু প্রশাসকের জন্য' })}>
        {t({
          en: 'Issuing and withdrawing staff access belongs to the city administrator.',
          bn: 'কর্মীদের প্রবেশাধিকার দেওয়া ও ফিরিয়ে নেওয়া সিটি প্রশাসকের দায়িত্ব।',
        })}
      </EmptyState>
    );
  }
  return <>{children}</>;
}

function NotFound() {
  const { t } = useUi();
  return (
    <EmptyState icon="search" title={t({ en: 'Nothing at this address', bn: 'এই ঠিকানায় কিছু নেই' })}>
      {t({ en: 'Check the link, or go back to the map.', bn: 'লিংকটি দেখে নিন, অথবা মানচিত্রে ফিরে যান।' })}
    </EmptyState>
  );
}
