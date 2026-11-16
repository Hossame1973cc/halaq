import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { isConfigured } from './lib/supabase';
import { AuthProvider, useAuth } from './lib/auth';
import Layout from './components/Layout';
import { Loading } from './components/ui';
import SetupNeeded from './pages/SetupNeeded';
import Home from './pages/Home';
import ShopPage from './pages/ShopPage';
import ManageBooking from './pages/ManageBooking';
import MyBookings from './pages/MyBookings';
import { Login, Signup } from './pages/Auth';
import Onboarding from './pages/Onboarding';
import Partners from './pages/Partners';
import NotFound from './pages/NotFound';
import DashboardLayout, { DashboardIndex } from './pages/dashboard/DashboardLayout';
import Queue from './pages/dashboard/Queue';
import Services from './pages/dashboard/Services';
import Team from './pages/dashboard/Team';
import Hours from './pages/dashboard/Hours';
import Settings from './pages/dashboard/Settings';
import Share from './pages/dashboard/Share';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return children;
}

export default function App() {
  if (!isConfigured) return <SetupNeeded />;
  return (
    <AuthProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="s/:slug" element={<ShopPage />} />
          <Route path="b/:token" element={<ManageBooking />} />
          <Route path="my" element={<MyBookings />} />
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<Signup />} />
          <Route path="partners" element={<Partners />} />
          <Route path="start" element={<RequireAuth><Onboarding /></RequireAuth>} />
          <Route path="dashboard" element={<RequireAuth><DashboardIndex /></RequireAuth>} />
          <Route path="dashboard/:shopId" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
            <Route index element={<Queue />} />
            <Route path="services" element={<Services />} />
            <Route path="team" element={<Team />} />
            <Route path="hours" element={<Hours />} />
            <Route path="settings" element={<Settings />} />
            <Route path="share" element={<Share />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
