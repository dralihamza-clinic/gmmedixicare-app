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
  "id, full_name, date_of_birth, phone, email, primary_doctor_id, notes, sex, created_at";

type PatientRow = Patient & { medical_records: { visit_date: string }[] | null };

function withStats(row: PatientRow): PatientWithStats {
  const { medical_records, ...patient } = row;
  const dates = (medical_records ?? []).map((r) => r.visit_date).sort();
  return {
    ...patient,
    visit_count: dates.length,
    last_visit: dates.length ? dates[dates.length - 1] : null,
  };
}

// Characters with meaning inside a PostgREST or=(...) filter. Stripping them
// keeps user input from breaking (or altering) the filter.
function sanitizeSearch(query: string): string {
  return query.replace(/[,()*%\\"]/g, " ").trim();
}

// Matches name or phone (case-insensitive, substring). An empty query returns
// the most recently added patients. The digits-only term lets "0300 1234"
// find a number stored as "+923001234567".
export async function searchPatients(query: string, limit = 50): Promise<PatientWithStats[]> {
  let request = supabase
    .from("patients")
    .select(`${PATIENT_COLUMNS}, medical_records(visit_date)`)
    .order("created_at", { ascending: false })
    .limit(limit);

  const q = sanitizeSearch(query);
  if (q) {
    const terms = [`full_name.ilike.*${q}*`, `phone.ilike.*${q}*`];
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

async function createPatient(input: NewPatientInput, primaryDoctorId: string): Promise<Patient> {
  if (!input.full_name.trim()) throw new Error("Patient name is required.");
  const { data, error } = await supabase
    .from("patients")
    .insert({
      full_name: input.full_name.trim(),
      // E.164 when it parses (older appointments may carry free text).
      phone: toE164(input.phone) ?? (input.phone?.trim() || null),
      email: input.email?.trim() || null,
      sex: input.sex || null,
      date_of_birth: input.date_of_birth || null,
      primary_doctor_id: primaryDoctorId,
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
  | { kind: "existing"; patient: Patient; /** Fills patients.sex if it was blank. */ sex?: string | null }
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

  // Best-effort: fill in sex on an existing patient whose row didn't have it.
  // The visit is already saved, so a failure here only logs.
  if (options.patient.kind === "existing" && options.patient.sex && !patient.sex) {
    const { error } = await supabase
      .from("patients")
      .update({ sex: options.patient.sex })
      .eq("id", patient.id);
    if (error) console.error("Couldn't update patient sex:", error.message);
  }

  return patient.id;
}

// Whole years between date of birth and the visit date (both "YYYY-MM-DD").
export function ageOn(dateOfBirth: string, onDate: string): number | null {
  const [by, bm, bd] = dateOfBirth.split("-").map(Number);
  const [vy, vm, vd] = onDate.split("-").map(Number);
  if ([by, bm, bd, vy, vm, vd].some(Number.isNaN)) return null;
  let age = vy - by;
  if (vm < bm || (vm === bm && vd < bd)) age -= 1;
  return age >= 0 ? age : null;
}

export function formatDate(date: string | null): string {
  if (!date) return "—";
  const [y, m, d] = date.split("-").map(Number);
  const value = new Date(y, m - 1, d);
  if (Number.isNaN(value.getTime())) return date;
  return value.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
