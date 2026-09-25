import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listDoctors } from "../lib/doctors";
import type { Doctor } from "../lib/types";
import DoctorAvatar from "../components/DoctorAvatar";
import DoctorRowActions from "../components/DoctorRowActions";
import Icon from "../components/Icon";

export default function DoctorsListPage() {
  const [doctors, setDoctors] = useState<Doctor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Client-side: the doctor list is small and already fully loaded.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !doctors) return doctors;
    return doctors.filter((d) =>
      [d.name, d.specialization].some((field) => field?.toLowerCase().includes(q))
    );
  }, [doctors, query]);

  const load = useCallback(async () => {
    try {
      setDoctors(await listDoctors());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load doctors.");
      setDoctors((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-headline-md text-headline-md text-primary">Doctors</h1>
        <Link
          to="/doctors/new"
          className="bg-secondary text-on-secondary font-label-caps text-label-caps px-5 py-2.5 rounded-full flex items-center gap-1.5 hover:bg-secondary/90 transition-colors"
        >
          <Icon name="add" className="text-lg" />
          Add Doctor
        </Link>
      </div>

      <div className="relative max-w-md">
        <Icon
          name="search"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or specialization"
          className="w-full rounded-lg border border-outline-variant pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
        />
      </div>

      {error && <p className="text-error text-sm">{error}</p>}

      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-variant divide-y divide-outline-variant/40">
        {doctors === null && (
          <p className="p-6 text-on-surface-variant text-sm">Loading…</p>
        )}
        {doctors?.length === 0 && (
          <p className="p-6 text-on-surface-variant text-sm">
            No doctors yet. Add your first one.
          </p>
        )}
        {doctors && doctors.length > 0 && visible?.length === 0 && (
          <p className="p-6 text-on-surface-variant text-sm">
            No doctors match "{query.trim()}".
          </p>
        )}
        {visible?.map((doctor) => (
          <div key={doctor.id} className="flex items-center gap-4 p-5">
            <DoctorAvatar name={doctor.name} src={doctor.profile_picture} />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-primary truncate">{doctor.name}</p>
              <p className="text-sm text-on-surface-variant truncate">
                {[doctor.qualifications, doctor.specialization]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                doctor.active
                  ? "bg-secondary-fixed/30 text-on-secondary-fixed-variant"
                  : "bg-surface-variant text-on-surface-variant"
              }`}
            >
              {doctor.active ? "Active" : "Inactive"}
            </span>
            <Link
              to={`/doctors/${doctor.id}/edit`}
              className="text-sm font-semibold text-primary hover:underline shrink-0"
            >
              Edit
            </Link>
            <div className="shrink-0">
              <DoctorRowActions
                id={doctor.id}
                active={doctor.active}
                onChanged={() => void load()}
                onError={setError}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
