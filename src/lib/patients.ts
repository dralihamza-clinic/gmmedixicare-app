import { supabase } from "./supabase";
import { phoneMatchVariants, searchDigits, toE164 } from "./phone";
import type {
  MedicalRecordWithDoctor,
  NewPatientInput,
  Patient,
  PatientWithStats,
  VisitInput,
} from "./types";

// Admins manage patients and medical_records via RLS ("Admins can manage
// ..."). As in doctors.ts, denied writes affect 0 rows rather than raising,
// so writes use .select() and check for that.

const PATIENT_COLUMNS =
  "id, full_name, date_of_birth, phone, mri_id, primary_doctor_id, notes, sex, created_at";

type PatientRow = Patient & {
  medical_records: { visit_date: string; fee: number | string | null }[] | null;
};

function withStats(row: PatientRow): PatientWithStats {
  const { medical_records, ...patient } = row;
  const records = medical_records ?? [];
  const dates = records.map((r) => r.visit_date).sort();
  return {
    ...patient,
    visit_count: dates.length,
    last_visit: dates.length ? dates[dates.length - 1] : null,
    total_paid: records.reduce((sum, r) => sum + (Number(r.fee) || 0), 0),
  };
}

// Characters with meaning inside a PostgREST or=(...) filter. Stripping them
// keeps user input from breaking (or altering) the filter.
function sanitizeSearch(query: string): string {
  return query.replace(/[,()*%\\"]/g, " ").trim();
}

// Matches name, phone, or MRI ID (case-insensitive, substring). An empty query returns
// the most recently added patients. The digits-only term lets "0300 1234"
// find a number stored as "+923001234567".
export async function searchPatients(query: string, limit = 50): Promise<PatientWithStats[]> {
  let request = supabase
    .from("patients")
    .select(`${PATIENT_COLUMNS}, medical_records(visit_date, fee)`)
    .order("created_at", { ascending: false })
    .limit(limit);

  const q = sanitizeSearch(query);
  if (q) {
    const terms = [`full_name.ilike.*${q}*`, `phone.ilike.*${q}*`, `mri_id.ilike.*${q}*`];
    const digits = searchDigits(q);
    if (digits.length >= 3) terms.push(`phone.ilike.*${digits}*`);
    request = request.or(terms.join(","));
  }

  const { data, error } = await request;
  if (error) throw new Error(error.message);
  return ((data ?? []) as PatientRow[]).map(withStats);
}

export async function getPatient(id: string): Promise<Patient | null> {
  const { data, error } = await supabase
    .from("patients")
    .select(PATIENT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Patient | null) ?? null;
}

// Exact match on the phone number in any of its common spellings (see
// phoneMatchVariants). If several patients share a number, the most recently
// added one wins.
export async function findPatientByPhone(phone: string): Promise<Patient | null> {
  const variants = phoneMatchVariants(phone);
  if (variants.length === 0) return null;
  const { data, error } = await supabase
    .from("patients")
    .select(PATIENT_COLUMNS)
    .in("phone", variants)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.[0] as Patient | undefined) ?? null;
}

export async function listPatientRecords(patientId: string): Promise<MedicalRecordWithDoctor[]> {
  const { data, error } = await supabase
    .from("medical_records")
    .select("*, doctor:doctors(name)")
    .eq("patient_id", patientId)
    .order("visit_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as MedicalRecordWithDoctor[];
}

// The age written on the patient's most recent visit that has one, with that
// visit's date. Age lives on each visit (medical_records.age), not on the
// patient, so this is the "age on file" for patients without a date of birth.
export async function getLatestRecordedAge(
  patientId: string
): Promise<{ age: number; visitDate: string } | null> {
  const { data, error } = await supabase
    .from("medical_records")
    .select("age, visit_date")
    .eq("patient_id", patientId)
    .not("age", "is", null)
    .order("visit_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const row = data?.[0];
  const age = row ? Number(row.age) : NaN;
  return row && Number.isFinite(age) ? { age, visitDate: row.visit_date as string } : null;
}

function patientFields(input: NewPatientInput) {
  if (!input.full_name.trim()) throw new Error("Patient name is required.");
  return {
    full_name: input.full_name.trim(),
    // E.164 when it parses (older appointments may carry free text).
    phone: toE164(input.phone) ?? (input.phone?.trim() || null),
    sex: input.sex || null,
    date_of_birth: input.date_of_birth || null,
  };
}

async function createPatient(input: NewPatientInput, primaryDoctorId: string): Promise<Patient> {
  const { data, error } = await supabase
    .from("patients")
    .insert({
      ...patientFields(input),
      primary_doctor_id: primaryDoctorId,
      // mri_id is left out: a DB trigger assigns it.
    })
    .select(PATIENT_COLUMNS)
    .single();
  if (error) throw new Error(`Couldn't save the patient: ${error.message}`);
  return data as Patient;
}

async function deleteRow(table: "patients" | "medical_records", id: string) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) console.error(`Rollback of ${table} ${id} failed:`, error.message);
}

export type VisitPatient =
  | { kind: "existing"; patient: Patient }
  | { kind: "new"; input: NewPatientInput };

// Saves a visit as one action: creates the patient if needed, inserts the
// medical record, and (from Mark Done) sets the appointment to 'done'. There's
// no server to run a transaction, so if a later step fails the rows created
// by earlier steps are deleted again. Returns the patient's id.
export async function saveVisit(options: {
  patient: VisitPatient;
  visit: VisitInput;
  appointmentId?: string;
}): Promise<string> {
  const { visit, appointmentId } = options;
  if (!visit.doctor_id) throw new Error("Choose the doctor for this visit.");
  if (!visit.visit_date) throw new Error("Visit date is required.");

  let patient: Patient;
  let createdPatient = false;
  if (options.patient.kind === "new") {
    patient = await createPatient(options.patient.input, visit.doctor_id);
    createdPatient = true;
  } else {
    patient = options.patient.patient;
  }

  const rollbackPatient = async () => {
    if (createdPatient) await deleteRow("patients", patient.id);
  };

  const { data: record, error: recordError } = await supabase
    .from("medical_records")
    .insert({ ...visit, patient_id: patient.id, appointment_id: appointmentId ?? null })
    .select("id")
    .single();
  if (recordError || !record) {
    await rollbackPatient();
    throw new Error(`Couldn't save the visit record: ${recordError?.message ?? "no row returned"}`);
  }

  if (appointmentId) {
    const { data, error } = await supabase
      .from("appointments")
      .update({ status: "done" })
      .eq("id", appointmentId)
      .select("id");
    if (error || !data || data.length === 0) {
      await deleteRow("medical_records", record.id);
      await rollbackPatient();
      throw new Error(
        `Couldn't mark the appointment done, so the record wasn't kept: ${
          error?.message ?? "appointment not found or no permission"
        }`
      );
    }
  }

  return patient.id;
}

// Corrects a past visit: updates the medical_records row in place and, when
// they changed, the patient's details (name, phone, sex, DOB). If the record
// update fails after the patient was changed, the patient is put back.
export async function updateVisit(options: {
  recordId: string;
  patient: Patient;
  patientInput: NewPatientInput;
  visit: VisitInput;
}): Promise<void> {
  const { recordId, patient, patientInput, visit } = options;
  if (!visit.doctor_id) throw new Error("Choose the doctor for this visit.");
  if (!visit.visit_date) throw new Error("Visit date is required.");

  const next = patientFields(patientInput);
  const previous = {
    full_name: patient.full_name,
    phone: patient.phone,
    sex: patient.sex,
    date_of_birth: patient.date_of_birth,
  };
  const patientChanged = (Object.keys(next) as (keyof typeof next)[]).some(
    (key) => (next[key] ?? null) !== (previous[key] ?? null)
  );

  if (patientChanged) {
    const { data, error } = await supabase
      .from("patients")
      .update(next)
      .eq("id", patient.id)
      .select("id");
    if (error || !data || data.length === 0) {
      throw new Error(
        `Couldn't update the patient: ${error?.message ?? "patient not found or no permission"}`
      );
    }
  }

  const { data, error } = await supabase
    .from("medical_records")
    .update(visit)
    .eq("id", recordId)
    .select("id");
  if (error || !data || data.length === 0) {
    if (patientChanged) {
      const { error: rollbackError } = await supabase
        .from("patients")
        .update(previous)
        .eq("id", patient.id);
      if (rollbackError) console.error(`Rollback of patients ${patient.id} failed:`, rollbackError.message);
    }
    throw new Error(
      `Couldn't update the visit record: ${error?.message ?? "record not found or no permission"}`
    );
  }
}

// "Rs. 1,500"; "—" when there's no fee.
export function formatFee(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  if (Number.isNaN(amount)) return String(value);
  return `Rs. ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

// Whole years between date of birth and the visit date (both "YYYY-MM-DD").
export function ageOn(dateOfBirth: string, onDate: string): number | null {
  const dob = toDateOnly(dateOfBirth);
  const on = toDateOnly(onDate);
  if (!dob || !on) return null;
  const [by, bm, bd] = dob.split("-").map(Number);
  const [vy, vm, vd] = on.split("-").map(Number);
  let age = vy - by;
  if (vm < bm || (vm === bm && vd < bd)) age -= 1;
  return age >= 0 ? age : null;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function monthNumber(name: string): number | null {
  const index = MONTHS.indexOf(name.slice(0, 3).toLowerCase());
  return index === -1 ? null : index + 1;
}

// Two-digit years: up to this year's two digits means 20xx, otherwise 19xx
// ("12/5/90" -> 1990, "3/1/15" -> 2015).
function fullYear(year: string): number {
  if (year.length === 4) return Number(year);
  const yy = Number(year);
  return yy <= new Date().getFullYear() % 100 ? 2000 + yy : 1900 + yy;
}

// Normalizes a stored date to "YYYY-MM-DD", or null if it isn't one.
// date_of_birth may hold dates typed in freehand, so besides a plain date and
// a timestamp ("1990-05-12T00:00:00+00:00") this accepts:
//   year first:   1990/05/12, 1990.5.12
//   day first:    12/05/1990, 12-5-90, 12.05.1990 (the local order; never
//                 read as month-first)
//   month names:  12 May 1990, 12-May-1990, May 12, 1990, 12th May 1990
export function toDateOnly(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;

  let y: number;
  let m: number;
  let d: number;
  let match: RegExpExecArray | null;
  if ((match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:$|[T\s])/.exec(text))) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})$/.exec(text))) {
    [y, m, d] = [fullYear(match[3]), Number(match[2]), Number(match[1])];
  } else if ((match = /^(\d{1,2})(?:st|nd|rd|th)?[\s\-/.,]+([a-z]+)\.?[\s\-/.,]+(\d{4}|\d{2})$/i.exec(text))) {
    const month = monthNumber(match[2]);
    if (month === null) return null;
    [y, m, d] = [fullYear(match[3]), month, Number(match[1])];
  } else if ((match = /^([a-z]+)\.?[\s\-/.]+(\d{1,2})(?:st|nd|rd|th)?[\s,]+(\d{4}|\d{2})$/i.exec(text))) {
    const month = monthNumber(match[1]);
    if (month === null) return null;
    [y, m, d] = [fullYear(match[3]), month, Number(match[2])];
  } else {
    return null;
  }
  const check = new Date(y, m - 1, d);
  // Rejects impossible dates such as 31/02.
  if (check.getFullYear() !== y || check.getMonth() !== m - 1 || check.getDate() !== d) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function formatDate(date: string | null): string {
  if (!date) return "—";
  const normalized = toDateOnly(date);
  if (!normalized) return date;
  const [y, m, d] = normalized.split("-").map(Number);
  const value = new Date(y, m - 1, d);
  return value.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
