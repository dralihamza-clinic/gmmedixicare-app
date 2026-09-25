export interface Doctor {
  id: string;
  name: string;
  profile_picture: string | null;
  qualifications: string | null;
  specialization: string | null;
  experience: string | null;
  bio: string | null;
  consultation_fee: number | null;
  availability: string | null;
  telemedicine_enabled: boolean;
  active: boolean;
  created_at: string;
}

export type DoctorInput = Omit<Doctor, "id" | "created_at">;

export type StaffRole = "admin" | "doctor";

export interface StaffProfile {
  userId: string;
  email: string | null;
  role: StaffRole;
  doctorId: string | null;
}

export type AppointmentStatus = "pending" | "confirmed" | "done" | "missed" | "rejected";

export interface Appointment {
  id: string;
  doctor_id: string;
  patient_name: string;
  patient_phone: string;
  patient_email: string | null;
  preferred_date: string; // "YYYY-MM-DD"
  preferred_time: string; // "HH:MM"
  notes: string | null;
  status: AppointmentStatus;
  staff_note: string | null;
  created_at: string;
  updated_at: string;
}

/** Row as returned by listAppointments(): includes the doctor's name when RLS lets us read it. */
export interface AppointmentWithDoctor extends Appointment {
  doctor: { name: string } | null;
}

// The UI's value set for patients.sex. If the column has a CHECK constraint
// with different spellings, change the values here.
export const SEX_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
] as const;

export type Sex = (typeof SEX_OPTIONS)[number]["value"];

export interface Patient {
  id: string;
  full_name: string;
  date_of_birth: string | null; // "YYYY-MM-DD"
  phone: string | null;
  email: string | null;
  primary_doctor_id: string | null;
  notes: string | null;
  sex: string | null;
  created_at: string;
}

export interface PatientWithStats extends Patient {
  visit_count: number;
  last_visit: string | null; // "YYYY-MM-DD"
}

export type NewPatientInput = Pick<Patient, "full_name" | "phone" | "email" | "sex" | "date_of_birth">;

// Clinical fields are kept as strings (numbers come from number inputs), so
// they insert cleanly whether the columns are numeric or text.
export interface VisitInput {
  doctor_id: string;
  visit_date: string; // "YYYY-MM-DD"
  age: string | null;
  temperature: string | null;
  blood_pressure: string | null;
  pulse: string | null;
  weight: string | null;
  labs: string | null;
  hx: string | null;
  treatment_plan: string | null;
}

export interface MedicalRecord {
  id: string;
  patient_id: string;
  doctor_id: string;
  visit_date: string;
  appointment_id: string | null;
  age: number | string | null;
  temperature: number | string | null;
  blood_pressure: string | null;
  pulse: number | string | null;
  weight: number | string | null;
  labs: string | null;
  hx: string | null;
  treatment_plan: string | null;
  created_at: string;
}

export interface MedicalRecordWithDoctor extends MedicalRecord {
  doctor: { name: string } | null;
}
