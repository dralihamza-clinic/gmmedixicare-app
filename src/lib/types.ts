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
