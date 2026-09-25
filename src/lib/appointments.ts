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
  /** Only rows created strictly after this ISO timestamp. */
  createdAfter?: string;
}): Promise<AppointmentWithDoctor[]> {
  // doctor is null for doctor accounts (they can't read public.doctors),
  // which is fine: they only ever see their own appointments anyway.
  let query = supabase
    .from("appointments")
    .select("*, doctor:doctors(name)")
    .order("created_at", { ascending: false });
  if (options?.createdAfter) query = query.gt("created_at", options.createdAfter);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as AppointmentWithDoctor[];
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
  staffNote?: string | null,
  /** New slot for a reschedule; overwrites preferred_date / preferred_time. */
  newSlot?: { date: string; time: string }
): Promise<void> {
  const values: Partial<Appointment> = { status };
  if (staffNote !== undefined) values.staff_note = staffNote?.trim() || null;
  if (newSlot) {
    values.preferred_date = newSlot.date;
    values.preferred_time = newSlot.time;
  }

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

// "2026-10-03" + "14:30" -> "Sat, Oct 3, 2026 · 2:30 PM". Parses the date as
// local (new Date("2026-10-03") would be UTC midnight, a day early in the
// Americas).
export function formatPreferredSlot(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const slot = new Date(y, m - 1, d, hh || 0, mm || 0);
  if (Number.isNaN(slot.getTime())) return `${date} · ${time}`;

  const day = slot.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const clock = Number.isNaN(hh)
    ? time
    : slot.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${clock}`;
}
