import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { supabase } from "../lib/supabase";
import { todayLocal } from "../lib/appointments";
import Icon from "../components/Icon";

interface Counts {
  total: number;
  active: number;
  today: number;
  pending: number;
  seenThisWeek: number;
}

// "YYYY-MM-DD" for `days` days before today (local time).
function daysAgoLocal(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function StatCard({
  label,
  value,
  icon,
  to,
  hint,
}: {
  label: string;
  value: number | undefined;
  icon: string;
  to?: string;
  hint?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-on-surface-variant">{label}</p>
        <Icon name={icon} className="text-xl text-secondary" />
      </div>
      <p className="text-3xl font-bold text-primary mt-1">{value ?? "–"}</p>
      {hint && <p className="text-xs text-on-surface-variant mt-1">{hint}</p>}
    </>
  );
  const className =
    "bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-surface-variant";
  return to ? (
    <Link to={to} className={`${className} hover:border-secondary transition-colors`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export default function OverviewPage() {
  const { staff } = useAuth();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = staff?.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    const head = { count: "exact", head: true } as const;
    const today = todayLocal();

    Promise.all([
      supabase.from("doctors").select("*", head),
      supabase.from("doctors").select("*", head).eq("active", true),
      // Rejected requests aren't appointments, so they don't count for today.
      supabase
        .from("appointments")
        .select("*", head)
        .eq("preferred_date", today)
        .neq("status", "rejected"),
      supabase.from("appointments").select("*", head).eq("status", "pending"),
      // Last 7 days including today.
      supabase
        .from("medical_records")
        .select("*", head)
        .gte("visit_date", daysAgoLocal(6))
        .lte("visit_date", today),
    ]).then(([all, active, todays, pending, seen]) => {
      if (cancelled) return;
      const failure = all.error ?? active.error ?? todays.error ?? pending.error ?? seen.error;
      if (failure) setError(failure.message);
      setCounts({
        total: all.count ?? 0,
        active: active.count ?? 0,
        today: todays.count ?? 0,
        pending: pending.count ?? 0,
        seenThisWeek: seen.count ?? 0,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  if (!staff) return null; // layout already handles this case

  if (staff.role === "doctor") {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="font-headline-md text-headline-md text-primary">
          Welcome back
        </h1>
        <p className="text-on-surface-variant">
          Your patient dashboard is on its way. For now,{" "}
          <Link to="/my-patients" className="text-secondary hover:underline">
            check My Patients
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline-md text-headline-md text-primary">
          Clinic Overview
        </h1>
        <p className="text-on-surface-variant mt-1">
          Signed in as {staff.email} (admin)
        </p>
      </div>

      {error && <p className="text-error text-sm">Couldn't load counts: {error}</p>}

      <div className="flex flex-col gap-3 max-w-4xl">
        <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wide">
          Appointments &amp; Patients
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Today's Appointments"
            value={counts?.today}
            icon="today"
            to="/appointments"
          />
          <StatCard
            label="Pending Requests"
            value={counts?.pending}
            icon="pending_actions"
            to="/appointments"
          />
          <StatCard
            label="Patients Seen This Week"
            value={counts?.seenThisWeek}
            icon="clinical_notes"
            to="/patients"
            hint="Visit records, last 7 days"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 max-w-4xl">
        <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wide">
          Doctors
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total Doctors" value={counts?.total} icon="stethoscope" to="/doctors" />
          <StatCard label="Active on Website" value={counts?.active} icon="public" to="/doctors" />
        </div>
      </div>

      <Link
        to="/doctors"
        className="self-start bg-secondary text-on-secondary font-label-caps text-label-caps px-6 py-3 rounded-full flex items-center gap-2 hover:bg-secondary/90 transition-colors"
      >
        Manage Doctors
        <Icon name="arrow_forward" className="text-lg" />
      </Link>
    </div>
  );
}
