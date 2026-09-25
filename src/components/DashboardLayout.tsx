import { NavLink, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import SignOutButton from "./SignOutButton";
import Icon from "./Icon";
import logoMark from "../assets/logo-mark.png";

const ADMIN_NAV = [
  { to: "/", label: "Overview", icon: "dashboard", end: true },
  { to: "/doctors", label: "Doctors", icon: "stethoscope", end: false },
];

const DOCTOR_NAV = [
  { to: "/", label: "Overview", icon: "dashboard", end: true },
  { to: "/my-patients", label: "My Patients", icon: "groups", end: false },
];

function FullScreenMessage({
  icon,
  title,
  body,
  showSignOut,
}: {
  icon?: string;
  title: string;
  body?: string;
  showSignOut?: boolean;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-surface-container-low px-gutter text-center">
      <div className="max-w-md flex flex-col items-center gap-3">
        {icon && <Icon name={icon} className="text-4xl text-secondary" />}
        <h1 className="font-headline-md text-headline-md text-primary">{title}</h1>
        {body && <p className="text-on-surface-variant text-sm">{body}</p>}
        {showSignOut && (
          <div className="bg-primary rounded-full px-4 py-2 mt-2">
            <SignOutButton />
          </div>
        )}
      </div>
    </main>
  );
}

// Wraps every signed-in screen: guards access, then renders the sidebar shell.
export default function DashboardLayout() {
  const { loading, session, staff, staffError } = useAuth();

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-surface-container-low">
        <p className="text-on-surface-variant text-sm">Loading…</p>
      </main>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  if (staffError) {
    return (
      <FullScreenMessage
        icon="cloud_off"
        title="Couldn't load your account"
        body={`${staffError} Check your internet connection and try again.`}
        showSignOut
      />
    );
  }

  // Signed in, but no row in user_roles yet.
  if (!staff) {
    return (
      <FullScreenMessage
        icon="lock_person"
        title="No dashboard access yet"
        body="You're signed in, but this account isn't linked to a staff role. Ask a clinic admin to add you in Supabase (Table Editor → user_roles)."
        showSignOut
      />
    );
  }

  if (staff.role === "doctor" && !staff.doctorId) {
    return (
      <FullScreenMessage
        icon="badge"
        title="Doctor profile not linked"
        body="Your account has the doctor role but isn't linked to a doctor profile. Ask a clinic admin to set doctor_id on your user_roles row."
        showSignOut
      />
    );
  }

  const nav = staff.role === "admin" ? ADMIN_NAV : DOCTOR_NAV;

  return (
    <div className="h-screen flex bg-surface-container-low">
      <aside className="w-64 shrink-0 bg-primary text-surface flex flex-col justify-between gap-6 px-6 py-8">
        <div className="flex flex-col gap-10">
          <div className="flex items-center gap-2.5">
            <img src={logoMark} alt="" width={28} height={28} className="rounded-md" />
            <span className="font-display-lg-mobile text-lg font-bold text-surface-container-lowest">
              GmMedixicare
            </span>
          </div>
          <nav className="flex flex-col gap-1 w-full">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-on-primary/15 text-surface-container-lowest"
                      : "text-on-primary-container/90 hover:bg-on-primary/10"
                  }`
                }
              >
                <Icon name={item.icon} className="text-xl" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex flex-col gap-2 items-start">
          <span className="text-xs text-on-primary-container/60 break-all">
            {staff.email} · {staff.role}
          </span>
          <SignOutButton />
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto px-10 py-10">
        <Outlet />
      </main>
    </div>
  );
}
