import { useEffect, useState, type FormEvent } from "react";
import { listDoctors } from "../lib/doctors";
import { ageOn } from "../lib/patients";
import { todayLocal } from "../lib/appointments";
import { SEX_OPTIONS, type Doctor, type VisitInput } from "../lib/types";

export const fieldClass =
  "rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary";
const readOnlyClass =
  "rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 py-2 text-sm text-primary font-semibold";
const labelClass =
  "flex flex-col gap-1 text-xs font-semibold text-primary uppercase tracking-wide";

function text(data: FormData, key: string): string | null {
  return String(data.get(key) ?? "").trim() || null;
}

// The visit form, laid out like the clinic's paper prescription pad. Patient
// name is always read-only (it comes from the chosen/new/matched patient);
// age and sex are read-only when the patient record already has them.
export default function VisitRecordForm({
  patientName,
  dateOfBirth,
  sex,
  defaultDoctorId,
  lockDoctor = false,
  submitLabel,
  onSubmit,
  onCancel,
  secondaryAction,
}: {
  patientName: string;
  /** When set, Age is computed from it for the visit date and read-only. */
  dateOfBirth?: string | null;
  /** When set, Sex is read-only; otherwise the form asks for it. */
  sex?: string | null;
  defaultDoctorId?: string | null;
  /** Show defaultDoctorId read-only (e.g. the appointment's doctor). */
  lockDoctor?: boolean;
  submitLabel: string;
  /** `sex` is the value entered on the form (only when it wasn't fixed). */
  onSubmit: (visit: VisitInput, sex: string | null) => Promise<void>;
  onCancel: () => void;
  secondaryAction?: { label: string; onClick: () => Promise<void> };
}) {
  const [doctors, setDoctors] = useState<Doctor[] | null>(null);
  const [visitDate, setVisitDate] = useState(todayLocal());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listDoctors()
      .then((list) => {
        if (cancelled) return;
        // Active doctors first; inactive ones stay selectable for old visits.
        setDoctors(
          [...list].sort((a, b) => Number(b.active) - Number(a.active)),
        );
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Couldn't load doctors.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const computedAge = dateOfBirth ? ageOn(dateOfBirth, visitDate) : null;
  const sexLabel = SEX_OPTIONS.find((o) => o.value === sex)?.label ?? sex;

  async function run(action: () => Promise<void>) {
    setError(null);
    setSaving(true);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSaving(false);
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const visit: VisitInput = {
      doctor_id: String(data.get("doctor_id") ?? ""),
      visit_date: visitDate,
      age: computedAge !== null ? String(computedAge) : text(data, "age"),
      temperature: text(data, "temperature"),
      blood_pressure: text(data, "blood_pressure"),
      pulse: text(data, "pulse"),
      weight: text(data, "weight"),
      labs: text(data, "labs"),
      hx: text(data, "hx"),
      treatment_plan: text(data, "treatment_plan"),
    };
    void run(() => onSubmit(visit, sex ? null : text(data, "sex")));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Header: doctor + date, as at the top of the pad. */}
      <div className="grid grid-cols-3 gap-4">
        <label className={`${labelClass} col-span-2`}>
          Doctor
          {lockDoctor && defaultDoctorId ? (
            <>
              <input type="hidden" name="doctor_id" value={defaultDoctorId} />
              <div className={readOnlyClass}>
                {doctors
                  ? (doctors.find((d) => d.id === defaultDoctorId)?.name ??
                    "Unknown doctor")
                  : "Loading…"}
              </div>
            </>
          ) : (
            <select
              name="doctor_id"
              required
              defaultValue={defaultDoctorId ?? ""}
              key={doctors ? "loaded" : "loading"}
              className={fieldClass}
            >
              <option value="" disabled>
                {doctors ? "Select doctor…" : "Loading doctors…"}
              </option>
              {doctors?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.active ? "" : " (inactive)"}
                </option>
              ))}
            </select>
          )}
        </label>
        <label className={labelClass}>
          Date
          <input
            type="date"
            required
            value={visitDate}
            max={todayLocal()}
            onChange={(e) => setVisitDate(e.target.value)}
            className={fieldClass}
          />
        </label>
      </div>

      {/* Patient line. */}
      <div className="grid grid-cols-6 gap-4">
        <div className={`${labelClass} col-span-4`}>
          Patient Name
          <div className={readOnlyClass}>{patientName}</div>
        </div>
        <label className={labelClass}>
          Age
          {computedAge !== null ? (
            <div className={readOnlyClass}>{computedAge}</div>
          ) : (
            <input
              name="age"
              type="number"
              min={0}
              max={150}
              className={fieldClass}
            />
          )}
        </label>
        <label className={labelClass}>
          Sex
          {sex ? (
            <div className={readOnlyClass}>{sexLabel}</div>
          ) : (
            <select name="sex" defaultValue="" className={fieldClass}>
              <option value="">—</option>
              {SEX_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </label>
      </div>

      {/* Vitals. */}
      <div className="grid grid-cols-4 gap-4 p-4 rounded-xl bg-surface-container-low border border-outline-variant/50">
        <label className={labelClass}>
          Temp (°F)
          <input
            name="temperature"
            type="number"
            step="any"
            placeholder="98.6"
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          B.P.
          <input
            name="blood_pressure"
            placeholder="120/80"
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          Pulse (bpm)
          <input
            name="pulse"
            type="number"
            step="any"
            min={0}
            placeholder="72"
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          Weight (kg)
          <input
            name="weight"
            type="number"
            step="any"
            min={0}
            placeholder="70"
            className={fieldClass}
          />
        </label>
      </div>

      <label className={labelClass}>
        Labs
        <textarea
          name="labs"
          rows={2}
          className={`${fieldClass} normal-case tracking-normal font-normal`}
        />
      </label>
      <label className={labelClass}>
        Hx
        <textarea
          name="hx"
          rows={6}
          placeholder="History, presenting complaint, examination findings…"
          className={`${fieldClass} normal-case tracking-normal font-normal`}
        />
      </label>
      <label className={labelClass}>
        Treatment Plan / Rx
        <textarea
          name="treatment_plan"
          rows={6}
          placeholder="Medications, dosage, advice, follow-up…"
          className={`${fieldClass} normal-case tracking-normal font-normal`}
        />
      </label>

      {error && (
        <p className="text-sm text-error bg-error-container/40 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-4 pt-1">
        <div>
          {secondaryAction && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void run(secondaryAction.onClick)}
              className="text-sm font-semibold text-on-surface-variant hover:text-primary hover:underline disabled:opacity-50"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="text-sm font-semibold text-on-surface-variant hover:underline disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || doctors === null}
            className="bg-secondary text-on-secondary font-label-caps text-label-caps px-8 py-3 rounded-full hover:bg-secondary/90 transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
