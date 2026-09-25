import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { supabase } from "../lib/supabase";
import Icon from "../components/Icon";

// Stub for the future per-doctor dashboard. The data model and RLS already
// support this (see sql/002_roles_and_dashboard.sql: patients +
// medical_records, scoped to public.current_doctor_id()). When you're ready to
// build the real UI, this is the query to start from.
export default function MyPatientsPage() {
  const { staff } = useAuth();
  const doctorId = staff?.doctorId ?? null;
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!doctorId) return;
    let cancelled = false;

    supabase
      .from("patients")
      .select("*", { count: "exact", head: true })
      .eq("primary_doctor_id", doctorId)
      .then(({ count: total, error: failure }) => {
        if (cancelled) return;
        if (failure) setError(failure.message);
        else setCount(total ?? 0);
      });

    return () => {
      cancelled = true;
    };
  }, [doctorId]);

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <h1 className="font-headline-md text-headline-md text-primary">My Patients</h1>
      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-variant p-8 flex flex-col items-center text-center gap-3">
        <Icon name="history_edu" className="text-4xl text-secondary" />
        <p className="font-bold text-primary">Patient history — coming soon</p>
        <p className="text-sm text-on-surface-variant max-w-sm">
          {error
            ? `Couldn't load your patients: ${error}`
            : `You're signed in and scoped correctly (${count ?? "…"} patient${
                count === 1 ? "" : "s"
              } currently assigned to you), but the patient-history UI hasn't been built yet. The database already enforces that you'll only ever see your own patients.`}
        </p>
      </div>
    </div>
  );
}
