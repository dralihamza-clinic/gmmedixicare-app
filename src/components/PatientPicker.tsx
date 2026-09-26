import { useEffect, useState } from "react";
import { formatDate, formatFee, searchPatients } from "../lib/patients";
import type { PatientWithStats } from "../lib/types";
import Icon from "./Icon";
import { fieldClass } from "./VisitRecordForm";

// Search box + result list (name, MRI ID, phone, last visit, visit count,
// total paid). Used as
// the Patients page list and as the "Existing Patient" picker.
export default function PatientPicker({
  onSelect,
  autoFocus = false,
  listClassName = "",
}: {
  onSelect: (patient: PatientWithStats) => void;
  autoFocus?: boolean;
  listClassName?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientWithStats[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Debounced so typing a phone number doesn't fire a query per keystroke.
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      searchPatients(query)
        .then((list) => {
          if (cancelled) return;
          setResults(list);
          setError(null);
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : "Couldn't search patients.");
          setResults((prev) => prev ?? []);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Icon
          name="search"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant"
        />
        <input
          type="search"
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, phone number, or MRI ID"
          className={`${fieldClass} w-full pl-10 py-2.5`}
        />
      </div>

      {error && <p className="text-error text-sm">{error}</p>}

      <div
        className={`bg-surface-container-lowest rounded-xl border border-surface-variant divide-y divide-outline-variant/40 ${listClassName}`}
      >
        {results === null && <p className="p-5 text-on-surface-variant text-sm">Loading…</p>}
        {results?.length === 0 && (
          <p className="p-5 text-on-surface-variant text-sm">
            {query.trim() ? "No patients match this search." : "No patients yet."}
          </p>
        )}
        {results?.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            className="w-full text-left px-5 py-3.5 flex items-center gap-4 hover:bg-surface-container-low transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="font-bold text-primary truncate">{p.full_name}</p>
              <p className="text-sm text-on-surface-variant">
                {p.mri_id && <span className="font-semibold text-primary">{p.mri_id} · </span>}
                {p.phone || "No phone on file"}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-on-surface-variant">Last visit</p>
              <p className="text-sm font-semibold text-primary">{formatDate(p.last_visit)}</p>
            </div>
            <div className="text-right shrink-0 w-16">
              <p className="text-xs text-on-surface-variant">Visits</p>
              <p className="text-sm font-semibold text-primary">{p.visit_count}</p>
            </div>
            <div className="text-right shrink-0 w-24">
              <p className="text-xs text-on-surface-variant">Total paid</p>
              <p className="text-sm font-semibold text-primary">{formatFee(p.total_paid)}</p>
            </div>
            <Icon name="chevron_right" className="text-on-surface-variant" />
          </button>
        ))}
      </div>
    </div>
  );
}
