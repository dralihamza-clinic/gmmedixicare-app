import { useEffect, useRef, useState, type FormEvent } from "react";
import { listDoctors } from "../lib/doctors";
import { ageOn, formatDate, toDateOnly } from "../lib/patients";
import { todayLocal } from "../lib/appointments";
import { phoneError, toE164, type PhoneValue } from "../lib/phone";
import {
  SEX_OPTIONS,
  type Doctor,
  type MedicalRecord,
  type NewPatientInput,
  type VisitInput,
} from "../lib/types";
import PhoneField from "./PhoneField";

export const fieldClass =
  "rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary";
const readOnlyClass =
  "rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 py-2 text-sm text-primary font-semibold";
const labelClass =
  "flex flex-col gap-1 text-xs font-semibold text-primary uppercase tracking-wide";

function text(data: FormData, key: string): string | null {
  return String(data.get(key) ?? "").trim() || null;
}

// Pre-fill value for an input from a stored record field (number or text).
function initial(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

// The visit form, laid out like the clinic's paper prescription pad.
//
// Creating a visit: the patient's identity (name, MRI ID, phone, DOB) is
// read-only: it comes from the chosen/new/matched patient. For an existing
// patient (lockPatient) sex is read-only too; for a new one it's asked for
// when not yet known.
//
// Editing a past visit (editPatient + initialVisit): every field is editable,
// including the patient's details, since this corrects an earlier entry.
//
// Age is pre-filled from the DOB (as of the visit date) when there is one,
// and stays editable. The fee follows the chosen doctor's consultation fee
// and can be overridden.
export default function VisitRecordForm({
  patientName,
  phone,
  mriId,
  dateOfBirth,
  sex,
  lockPatient = false,
  editPatient = false,
  initialVisit,
  defaultDoctorId,
  lockDoctor = false,
  submitLabel,
  onSubmit,
  onCancel,
  secondaryAction,
}: {
  patientName: string;
  phone?: string | null;
  /** Shown (read-only) for existing patients, as "—" if they have none yet.
   *  Hidden for new patients, who get one from the DB on save. */
  mriId?: string | null;
  /** When set, Age is pre-filled from it for the visit date (still editable). */
  dateOfBirth?: string | null;
  /** When set (or lockPatient), Sex is read-only; otherwise the form asks for it. */
  sex?: string | null;
  /** Existing patient: their details can't be changed from the visit form. */
  lockPatient?: boolean;
  /** Editing a past visit: name, phone, DOB and sex become editable inputs. */
  editPatient?: boolean;
  /** Pre-fills the visit fields (doctor, date, vitals, notes, fee) for editing. */
  initialVisit?: MedicalRecord;
  defaultDoctorId?: string | null;
  /** Show defaultDoctorId read-only (e.g. the appointment's doctor). */
  lockDoctor?: boolean;
  submitLabel: string;
  /** `patient` holds the patient details as shown or entered on the form. */
  onSubmit: (visit: VisitInput, patient: NewPatientInput) => Promise<void>;
  onCancel: () => void;
  secondaryAction?: { label: string; onClick: () => Promise<void> };
}) {
  const [doctors, setDoctors] = useState<Doctor[] | null>(null);
  const [doctorId, setDoctorId] = useState(initialVisit?.doctor_id ?? defaultDoctorId ?? "");
  const [fee, setFee] = useState(initial(initialVisit?.fee));
  const [visitDate, setVisitDate] = useState(initialVisit?.visit_date ?? todayLocal());
  // A date input only takes "YYYY-MM-DD"; the stored value may be a timestamp.
  const [dob, setDob] = useState(toDateOnly(dateOfBirth) ?? "");
  // Older patients may have a free-text phone that isn't valid E.164; the
  // field then starts empty and the old value is kept unless staff enter one.
  const [phoneValue, setPhoneValue] = useState<PhoneValue | undefined>(
    (toE164(phone) as PhoneValue | null) ?? undefined
  );
  const legacyPhone = phone && !toE164(phone) ? phone : null;
  const [phoneMessage, setPhoneMessage] = useState("");
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

  // New visit with a doctor already set (Mark Done): once doctors load, start
  // the fee at that doctor's consultation fee. An edited visit keeps its own.
  useEffect(() => {
    if (!doctors || initialVisit || !doctorId) return;
    const doctor = doctors.find((d) => d.id === doctorId);
    setFee((current) => current || initial(doctor?.consultation_fee));
    // Only when the doctor list arrives; later doctor changes go through chooseDoctor.
  }, [doctors]);

  function chooseDoctor(id: string) {
    setDoctorId(id);
    setFee(initial(doctors?.find((d) => d.id === id)?.consultation_fee));
  }

  // Age on the visit date, from the DOB. It pre-fills the Age field, which
  // stays editable; changing the visit date or DOB recomputes it. An edited
  // visit starts from its saved age instead.
  const effectiveDob = editPatient ? dob : dateOfBirth;
  const computedAge = effectiveDob ? ageOn(effectiveDob, visitDate) : null;
  const [age, setAge] = useState(() =>
    initialVisit ? initial(initialVisit.age) || initial(computedAge) : initial(computedAge)
  );
  const lastComputedAge = useRef(computedAge);
  useEffect(() => {
    if (computedAge === lastComputedAge.current) return;
    lastComputedAge.current = computedAge;
    if (computedAge !== null) setAge(String(computedAge));
  }, [computedAge]);
  const sexLabel = SEX_OPTIONS.find((o) => o.value === sex)?.label ?? sex ?? "—";
  const sexFixed = !editPatient && (Boolean(sex) || lockPatient);
  const showMriId = lockPatient || editPatient || Boolean(mriId);

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

    let patient: NewPatientInput;
    if (editPatient) {
      const problem = !phoneValue && legacyPhone ? "" : phoneError(phoneValue);
      if (problem) {
        setPhoneMessage(problem);
        document.getElementById("visit-patient-phone")?.focus();
        return;
      }
      patient = {
        full_name: text(data, "full_name") ?? "",
        phone: phoneValue ?? legacyPhone,
        sex: text(data, "sex"),
        date_of_birth: dob || null,
      };
    } else {
      patient = {
        full_name: patientName,
        phone: phone ?? null,
        sex: sexFixed ? (sex ?? null) : text(data, "sex"),
        date_of_birth: dateOfBirth ?? null,
      };
    }

    const visit: VisitInput = {
      doctor_id: doctorId,
      visit_date: visitDate,
      age: age.trim() || null,
      temperature: text(data, "temperature"),
      blood_pressure: text(data, "blood_pressure"),
      pulse: text(data, "pulse"),
      weight: text(data, "weight"),
      labs: text(data, "labs"),
      hx: text(data, "hx"),
      treatment_plan: text(data, "treatment_plan"),
      fee: fee.trim() || null,
    };
    void run(() => onSubmit(visit, patient));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Patient: name and MRI ID. */}
      <div className="grid grid-cols-6 gap-4">
        <label className={`${labelClass} ${showMriId ? "col-span-4" : "col-span-6"}`}>
          Patient Name
          {editPatient ? (
            <input name="full_name" required defaultValue={patientName} className={fieldClass} />
          ) : (
            <div className={readOnlyClass}>{patientName}</div>
          )}
        </label>
        {showMriId && (
          <div className={`${labelClass} col-span-2`}>
            MRI ID
            <div className={readOnlyClass}>{mriId || "—"}</div>
          </div>
        )}
      </div>

      {/* Visit: doctor, date and fee. */}
      <div className="grid grid-cols-4 gap-4">
        <label className={`${labelClass} col-span-2`}>
          Doctor
          {lockDoctor && defaultDoctorId ? (
            <div className={readOnlyClass}>
              {doctors
                ? (doctors.find((d) => d.id === defaultDoctorId)?.name ??
                  "Unknown doctor")
                : "Loading…"}
            </div>
          ) : (
            <select
              required
              value={doctorId}
              onChange={(e) => chooseDoctor(e.target.value)}
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
        <label className={labelClass}>
          Fee (Rs.)
          <input
            type="number"
            step="any"
            min={0}
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            className={fieldClass}
          />
        </label>
      </div>

      {/* Patient details: phone, DOB, age, sex. */}
      <div className="grid grid-cols-6 gap-4">
        {editPatient ? (
          // A div, not a <label>: clicking a wrapping label would focus the
          // country picker instead of the number.
          <div className={`${labelClass} col-span-2`}>
            <label htmlFor="visit-patient-phone">Phone</label>
            <PhoneField
              id="visit-patient-phone"
              value={phoneValue}
              onChange={(next) => {
                setPhoneValue(next);
                if (phoneMessage) setPhoneMessage(phoneError(next));
              }}
              onBlur={() => {
                if (phoneValue) setPhoneMessage(phoneError(phoneValue));
              }}
              error={phoneMessage}
            />
            {legacyPhone && !phoneValue && (
              <span className="text-xs font-normal normal-case tracking-normal text-on-surface-variant">
                On file: {legacyPhone} (kept unless you enter a new number)
              </span>
            )}
          </div>
        ) : (
          <div className={`${labelClass} col-span-2`}>
            Phone
            <div className={readOnlyClass}>{phone || "—"}</div>
          </div>
        )}
        <label className={`${labelClass} col-span-2`}>
          Date of Birth
          {editPatient ? (
            <input
              type="date"
              value={dob}
              max={todayLocal()}
              onChange={(e) => setDob(e.target.value)}
              className={fieldClass}
            />
          ) : (
            <div className={readOnlyClass}>{formatDate(dateOfBirth ?? null)}</div>
          )}
        </label>
        <label className={labelClass}>
          Age
          <input
            type="number"
            min={0}
            max={150}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          Sex
          {sexFixed ? (
            <div className={readOnlyClass}>{sexLabel}</div>
          ) : (
            <select name="sex" defaultValue={editPatient ? (sex ?? "") : ""} className={fieldClass}>
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
            defaultValue={initial(initialVisit?.temperature)}
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          B.P.
          <input
            name="blood_pressure"
            placeholder="120/80"
            defaultValue={initial(initialVisit?.blood_pressure)}
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
            defaultValue={initial(initialVisit?.pulse)}
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
            defaultValue={initial(initialVisit?.weight)}
            className={fieldClass}
          />
        </label>
      </div>

      <label className={labelClass}>
        Labs
        <textarea
          name="labs"
          rows={2}
          defaultValue={initial(initialVisit?.labs)}
          className={`${fieldClass} normal-case tracking-normal font-normal`}
        />
      </label>
      <label className={labelClass}>
        Hx
        <textarea
          name="hx"
          rows={6}
          placeholder="History, presenting complaint, examination findings…"
          defaultValue={initial(initialVisit?.hx)}
          className={`${fieldClass} normal-case tracking-normal font-normal`}
        />
      </label>
      <label className={labelClass}>
        Treatment Plan / Rx
        <textarea
          name="treatment_plan"
          rows={6}
          placeholder="Medications, dosage, advice, follow-up…"
          defaultValue={initial(initialVisit?.treatment_plan)}
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
