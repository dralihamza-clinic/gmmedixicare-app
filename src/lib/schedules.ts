import { supabase } from "./supabase";

// One row per working day in public.doctor_schedules. day_of_week follows
// JavaScript's Date#getDay(): 0 = Sunday … 6 = Saturday. A day with no row
// means the doctor doesn't work that day.
export interface ScheduleRow {
  day_of_week: number;
  start_time: string; // "HH:MM" (Postgres returns "HH:MM:SS"; trimmed on load)
  end_time: string;
}

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const hhmm = (time: string) => time.slice(0, 5);

export async function getDoctorSchedule(doctorId: string): Promise<ScheduleRow[]> {
  const { data, error } = await supabase
    .from("doctor_schedules")
    .select("day_of_week, start_time, end_time")
    .eq("doctor_id", doctorId)
    .order("day_of_week", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    day_of_week: r.day_of_week,
    start_time: hhmm(r.start_time),
    end_time: hhmm(r.end_time),
  }));
}

// Throws a staff-readable message for the first day with missing or
// backwards times.
export function validateSchedule(rows: ScheduleRow[]): void {
  for (const r of rows) {
    if (!r.start_time || !r.end_time) {
      throw new Error(`${DAY_NAMES[r.day_of_week]}: enter a start and end time.`);
    }
    if (r.start_time >= r.end_time) {
      throw new Error(`${DAY_NAMES[r.day_of_week]}: end time must be after start time.`);
    }
  }
}

// Replaces every schedule row for the doctor. Without a server there's no
// transaction, so this deletes then inserts, and if the insert fails it puts
// the previous rows back rather than leaving the doctor with no hours.
export async function replaceDoctorSchedule(
  doctorId: string,
  rows: ScheduleRow[],
  previous: ScheduleRow[]
): Promise<void> {
  validateSchedule(rows);

  const { error: deleteError } = await supabase
    .from("doctor_schedules")
    .delete()
    .eq("doctor_id", doctorId);
  if (deleteError) throw new Error(`Couldn't save hours: ${deleteError.message}`);

  if (rows.length === 0) return;

  const { error: insertError } = await supabase
    .from("doctor_schedules")
    .insert(rows.map((r) => ({ ...r, doctor_id: doctorId })));
  if (insertError) {
    if (previous.length > 0) {
      const { error: restoreError } = await supabase
        .from("doctor_schedules")
        .insert(previous.map((r) => ({ ...r, doctor_id: doctorId })));
      if (restoreError) {
        throw new Error(
          `Couldn't save hours (${insertError.message}), and restoring the previous hours also failed (${restoreError.message}). Re-enter them and save again.`
        );
      }
    }
    throw new Error(`Couldn't save hours: ${insertError.message}. Previous hours were kept.`);
  }
}

// "09:30" -> "9:30 AM"
function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

// One-line summary. Days sharing the same hours are grouped, and consecutive
// days collapse into a range: "Mon–Sat, 9:30 AM – 6:00 PM", or
// "Mon–Wed, Fri, 9:00 AM – 1:00 PM · Sat, 10:00 AM – 2:00 PM".
export function summarizeSchedule(rows: ScheduleRow[]): string {
  if (rows.length === 0) return "Not set";

  const byHours = new Map<string, number[]>();
  for (const r of [...rows].sort((a, b) => a.day_of_week - b.day_of_week)) {
    const key = `${r.start_time}|${r.end_time}`;
    byHours.set(key, [...(byHours.get(key) ?? []), r.day_of_week]);
  }

  const short = (day: number) => DAY_NAMES[day].slice(0, 3);
  return [...byHours.entries()]
    .map(([key, days]) => {
      const runs: string[] = [];
      let start = days[0];
      let prev = days[0];
      for (const day of [...days.slice(1), Infinity]) {
        if (day === prev + 1) {
          prev = day;
          continue;
        }
        runs.push(start === prev ? short(start) : `${short(start)}–${short(prev)}`);
        start = prev = day;
      }
      const [from, to] = key.split("|");
      return `${runs.join(", ")}, ${formatTime(from)} – ${formatTime(to)}`;
    })
    .join(" · ");
}
