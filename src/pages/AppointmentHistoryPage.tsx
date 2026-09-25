import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import AppointmentDetails from "../components/AppointmentDetails";
import Icon from "../components/Icon";
import Tabs from "../components/Tabs";
import { listAppointments, slotToDate } from "../lib/appointments";
import { searchDigits } from "../lib/phone";
import type { AppointmentWithDoctor } from "../lib/types";

type TabId = "completed" | "missed";

const inputClass =
  "rounded-lg border-outline-variant bg-surface-container-lowest text-sm focus:border-secondary focus:ring-secondary";

// Case-insensitive name match; phone match ignores spaces, dashes, etc. so
// "0300 123" finds "0300-1234567".
function matchesSearch(a: AppointmentWithDoctor, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (a.patient_name.toLowerCase().includes(q)) return true;
  // Leading zeros dropped so "0300 123" also matches "+923001234567".
  const digits = searchDigits(q);
  return digits.length > 0 && a.patient_phone.replace(/\D/g, "").includes(digits);
}

export default function AppointmentHistoryPage() {
  const { staff } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentWithDoctor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("completed");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  // The date range filters in the database; search runs on the loaded rows.
  const load = useCallback(async () => {
    try {
      setAppointments(
        await listAppointments({
          statuses: ["done", "missed", "rejected"],
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        })
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load appointment history.");
      setAppointments((prev) => prev ?? []);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => {
    const result: Record<TabId, AppointmentWithDoctor[]> = { completed: [], missed: [] };
    for (const a of appointments ?? []) {
      if (!matchesSearch(a, search)) continue;
      result[a.status === "done" ? "completed" : "missed"].push(a);
    }
    // Most recent appointment first.
    const bySlotDesc = (x: AppointmentWithDoctor, y: AppointmentWithDoctor) =>
      slotToDate(y.preferred_date, y.preferred_time).getTime() -
      slotToDate(x.preferred_date, x.preferred_time).getTime();
    result.completed.sort(bySlotDesc);
    result.missed.sort(bySlotDesc);
    return result;
  }, [appointments, search]);

  const rows = groups[tab];
  const filtersActive = Boolean(dateFrom || dateTo || search.trim());
  const rangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-headline-md text-headline-md text-primary">Appointment History</h1>

      <div className="flex items-end gap-4 flex-wrap">
        <label className="flex flex-col gap-1 text-xs font-semibold text-primary">
          From
          <input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-primary">
          To
          <input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-primary flex-1 min-w-60">
          Search
          <span className="relative">
            <Icon
              name="search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Patient name or phone number"
              className={`${inputClass} w-full pl-10`}
            />
          </span>
        </label>
        {filtersActive && (
          <button
            onClick={() => {
              setDateFrom("");
              setDateTo("");
              setSearch("");
            }}
            className="text-sm font-semibold text-secondary hover:underline pb-2.5"
          >
            Clear filters
          </button>
        )}
      </div>

      {rangeInvalid && (
        <p className="text-error text-sm">"From" must be on or before "To".</p>
      )}

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "completed", label: "Completed", count: groups.completed.length },
          { id: "missed", label: "Missed", count: groups.missed.length },
        ]}
      />

      {error && <p className="text-error text-sm">{error}</p>}

      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-variant divide-y divide-outline-variant/40">
        {appointments === null && (
          <p className="p-6 text-on-surface-variant text-sm">Loading…</p>
        )}
        {appointments !== null && rows.length === 0 && (
          <p className="p-6 text-on-surface-variant text-sm">
            {filtersActive
              ? "No appointments match these filters."
              : tab === "completed"
                ? "No completed appointments yet."
                : "No missed or rejected appointments."}
          </p>
        )}
        {rows.map((appointment) => (
          <div key={appointment.id} className="p-5 flex items-start gap-4">
            <AppointmentDetails
              appointment={appointment}
              showDoctor={staff?.role === "admin"}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
