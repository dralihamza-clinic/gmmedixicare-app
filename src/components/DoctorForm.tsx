import { useState, type ChangeEvent, type FormEvent } from "react";
import { readDoctorForm, uploadDoctorPhoto } from "../lib/doctors";
import type { Doctor, DoctorInput } from "../lib/types";

const inputClass =
  "rounded-lg border border-outline-variant px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary";

// Shared form for the "Add doctor" and "Edit doctor" screens.
export default function DoctorForm({
  doctor,
  submitLabel,
  onSubmit,
}: {
  doctor?: Doctor;
  submitLabel: string;
  onSubmit: (values: DoctorInput) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(
    doctor?.profile_picture ?? null
  );
  const [uploading, setUploading] = useState(false);

  async function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      setPhotoUrl(await uploadDoctorPhoto(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit(readDoctorForm(new FormData(e.currentTarget)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-variant p-6 flex flex-col gap-6"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm font-semibold text-primary">Full name *</span>
          <input
            name="name"
            required
            defaultValue={doctor?.name}
            placeholder="Dr. Jane Doe"
            className={inputClass}
          />
        </label>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm font-semibold text-primary">Profile photo</span>
          <input type="hidden" name="profile_picture" value={photoUrl ?? ""} readOnly />
          <div className="flex items-center gap-4">
            {photoUrl && (
              <img
                src={photoUrl}
                alt=""
                className="w-16 h-16 rounded-full object-cover border border-outline-variant"
              />
            )}
            <label className="text-sm font-semibold text-secondary hover:underline cursor-pointer">
              {uploading ? "Uploading…" : photoUrl ? "Change photo" : "Upload photo"}
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-primary">Qualifications</span>
          <input
            name="qualifications"
            defaultValue={doctor?.qualifications ?? ""}
            placeholder="MBBS, FCPS"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-primary">Specialization</span>
          <input
            name="specialization"
            defaultValue={doctor?.specialization ?? ""}
            placeholder="Cardiologist"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-primary">Experience</span>
          <input
            name="experience"
            defaultValue={doctor?.experience ?? ""}
            placeholder="8+ years"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-primary">
            Consultation fee (Rs.)
          </span>
          <input
            name="consultation_fee"
            type="number"
            step="0.01"
            min="0"
            defaultValue={doctor?.consultation_fee ?? ""}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm font-semibold text-primary">Availability</span>
          <input
            name="availability"
            defaultValue={doctor?.availability ?? ""}
            placeholder="Mon–Sat, 10am–5pm"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm font-semibold text-primary">Bio</span>
          <textarea
            name="bio"
            rows={4}
            defaultValue={doctor?.bio ?? ""}
            className={inputClass}
          />
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="telemedicine_enabled"
            defaultChecked={doctor?.telemedicine_enabled ?? false}
            className="rounded border-outline-variant text-secondary focus:ring-secondary"
          />
          <span className="text-sm text-primary">Telemedicine enabled</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="active"
            defaultChecked={doctor?.active ?? true}
            className="rounded border-outline-variant text-secondary focus:ring-secondary"
          />
          <span className="text-sm text-primary">Active (visible on public site)</span>
        </label>
      </div>

      {error && (
        <p className="text-sm text-error bg-error-container/40 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving || uploading}
        className="self-start bg-secondary text-on-secondary font-label-caps text-label-caps px-8 py-3 rounded-full hover:bg-secondary/90 transition-colors disabled:opacity-60"
      >
        {saving ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
