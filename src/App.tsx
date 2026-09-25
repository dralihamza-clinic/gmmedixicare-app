import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { isSupabaseConfigured } from "./lib/supabase";
import DashboardLayout from "./components/DashboardLayout";
import RequireRole from "./components/RequireRole";
import LoginPage from "./pages/LoginPage";
import OverviewPage from "./pages/OverviewPage";
import DoctorsListPage from "./pages/DoctorsListPage";
import DoctorNewPage from "./pages/DoctorNewPage";
import DoctorEditPage from "./pages/DoctorEditPage";
import MyPatientsPage from "./pages/MyPatientsPage";
import AppointmentsPage from "./pages/AppointmentsPage";
import ConfigMissingPage from "./pages/ConfigMissingPage";

export default function App() {
  if (!isSupabaseConfigured) return <ConfigMissingPage />;

  // HashRouter (not BrowserRouter) because the packaged app loads from file://.
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<DashboardLayout />}>
            <Route index element={<OverviewPage />} />
            {/* Both roles: RLS limits doctors to their own appointments. */}
            <Route path="appointments" element={<AppointmentsPage />} />

            <Route element={<RequireRole role="admin" />}>
              <Route path="doctors" element={<DoctorsListPage />} />
              <Route path="doctors/new" element={<DoctorNewPage />} />
              <Route path="doctors/:id/edit" element={<DoctorEditPage />} />
            </Route>

            <Route element={<RequireRole role="doctor" />}>
              <Route path="my-patients" element={<MyPatientsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
