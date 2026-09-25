import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { supabase } from "../lib/supabase";
import Icon from "../components/Icon";

export default function OverviewPage() {
  const { staff } = useAuth();
  const [counts, setCounts] = useState<{ total: number; active: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = staff?.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;

    Promise.all([
      supabase.from("doctors").select("*", { count: "exact", head: true }),
      supabase
        .from("doctors")
        .select("*", { count: "exact", head: true })
        .eq("active", true),
    ]).then(([all, active]) => {
      if (cancelled) return;
      const failure = all.error ?? active.error;
      if (failure) setError(failure.message);
      else setCounts({ total: all.count ?? 0, active: active.count ?? 0 });
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-surface-variant">
          <p className="text-sm text-on-surface-variant">Total Doctors</p>
          <p className="text-3xl font-bold text-primary mt-1">{counts?.total ?? "–"}</p>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-surface-variant">
          <p className="text-sm text-on-surface-variant">Active on Website</p>
          <p className="text-3xl font-bold text-primary mt-1">{counts?.active ?? "–"}</p>
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
