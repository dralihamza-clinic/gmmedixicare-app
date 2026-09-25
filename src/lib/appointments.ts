import { supabase } from "./supabase";
import type {
  Appointment,
  AppointmentStatus,
  AppointmentWithDoctor,
} from "./types";

// RLS on public.appointments scopes every query here: admins see all rows,
// doctors only their own. As with doctors.ts, a denied update doesn't raise
// an error — it affects 0 rows — so writes use .select() and check for that.

export async function listAppointments(options?: {
  statuses?: AppointmentStatus[];
  /** Only rows created strictly after this ISO timestamp. */
  createdAfter?: string;
  /** Inclusive "YYYY-MM-DD" bounds on the appointment's preferred_date. */
  dateFrom?: string;
  dateTo?: string;
}): Promise<AppointmentWithDoctor[]> {
  // doctor is null for doctor accounts (they can't read public.doctors),
  // which is fine: they only ever see their own appointments anyway.
  let query = supabase
    .from("appointments")
    .select("*, doctor:doctors(name)")
    .order("created_at", { ascending: false });
  if (options?.statuses) query = query.in("status", options.statuses);
  if (options?.createdAfter) query = query.gt("created_at", options.createdAfter);
  if (options?.dateFrom) query = query.gte("preferred_date", options.dateFrom);
  if (options?.dateTo) query = query.lte("preferred_date", options.dateTo);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as AppointmentWithDoctor[];
}

async function updateAppointment(id: string, values: Partial<Appointment>): Promise<void> {
  const { data, error } = await supabase
    .from("appointments")
    .update(values)
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error(
      "Update failed: appointment not found or you don't have permission to change it."
    );
  }
}

// Adds a dated line to the existing staff_note instead of replacing it, so
// earlier reschedules and reasons stay on record.
function appendStaffNote(existing: string | null, line: string): string {
  const stamp = new Date().toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const entry = `[${stamp}] ${line}`;
  return existing?.trim() ? `${existing.trim()}\n${entry}` : entry;
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
  staffNote?: string | null
): Promise<void> {
  const values: Partial<Appointment> = { status };
  if (staffNote !== undefined) values.staff_note = staffNote?.trim() || null;
  await updateAppointment(id, values);
}

// Moves the slot but keeps the status ('pending' or 'confirmed'). The old
// slot is recorded in staff_note before preferred_date/time are overwritten.
export async function rescheduleAppointment(
  appointment: Appointment,
  newSlot: { date: string; time: string },
  note?: string
): Promise<void> {
  const from = formatPreferredSlot(appointment.preferred_date, appointment.preferred_time);
  const to = formatPreferredSlot(newSlot.date, newSlot.time);
  const extra = note?.trim() ? ` — ${note.trim()}` : "";

  await updateAppointment(appointment.id, {
    preferred_date: newSlot.date,
    preferred_time: newSlot.time,
    staff_note: appendStaffNote(appointment.staff_note, `Rescheduled from ${from} to ${to}${extra}`),
  });
}

export async function markAppointmentDone(appointment: Appointment): Promise<void> {
  await updateAppointment(appointment.id, { status: "done" });
}

export async function markAppointmentMissed(
  appointment: Appointment,
  reason: string
): Promise<void> {
  if (!reason.trim()) throw new Error("A reason is required to mark an appointment as missed.");
  await updateAppointment(appointment.id, {
    status: "missed",
    staff_note: appendStaffNote(appointment.staff_note, `Missed: ${reason.trim()}`),
  });
}

// Calls onInsert for every new appointment this user is allowed to see
// (Realtime applies the table's SELECT policies per subscriber). Returns an
// unsubscribe function for useEffect cleanup.
export function subscribeToNewAppointments(
  onInsert: (appointment: Appointment) => void
): () => void {
  const channel = supabase
    .channel(`appointments-inserts-${crypto.randomUUID()}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "appointments" },
      (payload) => onInsert(payload.new as Appointment)
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

// The appointment's slot as a local Date. Parses the parts by hand because
// new Date("2026-10-03") is UTC midnight, a day early in the Americas.
export function slotToDate(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0);
}

// "2026-10-03" + "14:30" -> "Sat, Oct 3, 2026 · 2:30 PM".
export function formatPreferredSlot(date: string, time: string): string {
  const slot = slotToDate(date, time);
  if (Number.isNaN(slot.getTime())) return `${date} · ${time}`;

  const day = slot.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const clock = Number.isNaN(Number(time.split(":")[0]))
    ? time
    : slot.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${clock}`;
}

export function todayLocal(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
