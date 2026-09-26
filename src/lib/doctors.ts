import { supabase } from "./supabase";
import type { Doctor, DoctorInput } from "./types";

// RLS ("Admins can manage doctors") is what really enforces who may write.
// A denied update/delete does not raise an error in Supabase — it just
// affects 0 rows — so write helpers use .select() and check for that.

export function readDoctorForm(formData: FormData): DoctorInput {
  const text = (key: string) => String(formData.get(key) ?? "").trim() || null;
  const fee = String(formData.get("consultation_fee") ?? "").trim();

  return {
    name: String(formData.get("name") ?? "").trim(),
    profile_picture: text("profile_picture"),
    qualifications: text("qualifications"),
    specialization: text("specialization"),
    experience: text("experience"),
    bio: text("bio"),
    consultation_fee: fee ? Number(fee) : null,
    availability: text("availability"),
    telemedicine_enabled: formData.get("telemedicine_enabled") === "on",
    active: formData.get("active") === "on",
  };
}

// Uploads a photo to the public "doctor-photos" Storage bucket and returns
// its public URL. Only succeeds for signed-in admins — enforced by the
// storage RLS policies in sql/003_doctor_photos_storage.sql.
export async function uploadDoctorPhoto(file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("doctor-photos")
    .upload(path, file, { upsert: false });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from("doctor-photos").getPublicUrl(path);
  return data.publicUrl;
}

export async function listDoctors(): Promise<Doctor[]> {
  const { data, error } = await supabase
    .from("doctors")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Doctor[];
}

export async function getDoctor(id: string): Promise<Doctor | null> {
  const { data, error } = await supabase
    .from("doctors")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Doctor | null) ?? null;
}

// Returns the new doctor's id.
export async function createDoctor(values: DoctorInput): Promise<string> {
  if (!values.name) throw new Error("Name is required.");
  const { data, error } = await supabase.from("doctors").insert(values).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function updateDoctor(
  id: string,
  values: Partial<DoctorInput>
): Promise<void> {
  if (values.name !== undefined && !values.name) {
    throw new Error("Name is required.");
  }
  const { data, error } = await supabase
    .from("doctors")
    .update(values)
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Update failed: doctor not found or you don't have permission.");
  }
}

export async function deleteDoctor(id: string): Promise<void> {
  const { data, error } = await supabase
    .from("doctors")
    .delete()
    .eq("id", id)
    .select("id");
  // 23503 = foreign key violation: visit records or appointments still point
  // at this doctor.
  if (error?.code === "23503") {
    throw new Error(
      "This doctor has visit records or appointments, so they can't be deleted. Keep them deactivated instead."
    );
  }
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Delete failed: doctor not found or you don't have permission.");
  }
}
