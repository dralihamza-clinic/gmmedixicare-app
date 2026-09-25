import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { StaffRole } from "../lib/types";

// Route guard used inside DashboardLayout (which already guarantees `staff`).
export default function RequireRole({ role }: { role: StaffRole }) {
  const { staff } = useAuth();
  if (staff?.role !== role) return <Navigate to="/" replace />;
  return <Outlet />;
}
