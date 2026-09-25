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

export type AppointmentStatus = "pending" | "confirmed" | "rejected" | "rescheduled";

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
