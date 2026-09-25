import { useEffect, useState } from "react";
import {
  DAY_NAMES,
  getDoctorSchedule,
  replaceDoctorSchedule,
  summarizeSchedule,
  type ScheduleRow,
} from "../lib/schedules";
import Icon from "./Icon";

interface DayState {
  enabled: boolean;
  start: string;
  end: string;
}

const DEFAULT_START = "09:00";
const DEFAULT_END = "17:00";

function toDays(rows: ScheduleRow[]): DayState[] {
  return DAY_NAMES.map((_, day) => {
    const row = rows.find((r) => r.day_of_week === day);
    return row
      ? { enabled: true, start: row.start_time, end: row.end_time }
      : { enabled: false, start: DEFAULT_START, end: DEFAULT_END };
  });
}

function toRows(days: DayState[]): ScheduleRow[] {
  return days.flatMap((d, day) =>
    d.enabled ? [{ day_of_week: day, start_time: d.start, end_time: d.end }] : []
  );
}

const sameRows = (a: ScheduleRow[], b: ScheduleRow[]) => JSON.stringify(a) === JSON.stringify(b);

const timeClass =
  "rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary disabled:bg-surface-container-low disabled:text-outline disabled:cursor-not-allowed";

// Structured weekly hours (public.doctor_schedules), separate from the
// free-text "Availability" field on the doctor form. Collapsed to a one-line
// summary until expanded.
export default function WorkingHoursSection({ doctorId }: { doctorId: string }) {
  const [saved, setSaved] = useState<ScheduleRow[] | null>(null);
  const [days, setDays] = useState<DayState[]>(() => toDays([]));
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDoctorSchedule(doctorId)
      .then((rows) => {
        if (cancelled) return;
        setSaved(rows);
        setDays(toDays(rows));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load working hours.");
      });
    return () => {
      cancelled = true;
    };
  }, [doctorId]);

  const draft = toRows(days);
  const dirty = saved !== null && !sameRows(draft, saved);

  function update(day: number, patch: Partial<DayState>) {
    setNotice(null);
    setDays((prev) => prev.map((d, i) => (i === day ? { ...d, ...patch } : d)));
  }

  function toggle(day: number, enabled: boolean) {
    // Turning a day on copies the nearest earlier working day's hours, so
    // filling in a regular week is mostly ticking boxes.
    if (enabled && !days[day].enabled) {
      const template = [...days.slice(0, day)].reverse().find((d) => d.enabled);
      if (template) {
        update(day, { enabled, start: template.start, end: template.end });
        return;
      }
    }
    update(day, { enabled });
  }

  async function save() {
    if (!saved) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await replaceDoctorSchedule(doctorId, draft, saved);
      setSaved(draft);
      setNotice("Hours saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save hours.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-variant">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="working-hours-editor"
        className="w-full flex items-center gap-4 p-6 text-left"
      >
        <Icon name="schedule" className="text-xl text-secondary" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary">Working hours</p>
          <p className="text-sm text-on-surface-variant truncate">
            {saved === null ? (error ? "Couldn't load" : "Loading…") : summarizeSchedule(saved)}
            {dirty && <span className="text-secondary font-semibold"> · unsaved changes</span>}
          </p>
        </div>
        <Icon
          name="expand_more"
          className={`text-2xl text-on-surface-variant transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div id="working-hours-editor" className="px-6 pb-6 flex flex-col gap-4">
          <div className="flex flex-col divide-y divide-outline-variant/40 border-y border-outline-variant/40">
            {DAY_NAMES.map((name, day) => {
              const d = days[day];
              return (
                <div key={name} className="flex items-center gap-4 py-2.5">
                  <label className="flex items-center gap-2.5 w-36 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={d.enabled}
                      disabled={saved === null}
                      onChange={(e) => toggle(day, e.target.checked)}
                      className="rounded border-outline-variant text-secondary focus:ring-secondary"
                    />
                    <span className={`text-sm ${d.enabled ? "text-primary font-semibold" : "text-on-surface-variant"}`}>
                      {name}
                    </span>
                  </label>
                  <input
                    type="time"
                    aria-label={`${name} start time`}
                    value={d.start}
                    disabled={!d.enabled}
                    required={d.enabled}
                    onChange={(e) => update(day, { start: e.target.value })}
                    className={timeClass}
                  />
                  <span className="text-sm text-on-surface-variant">to</span>
                  <input
                    type="time"
                    aria-label={`${name} end time`}
                    value={d.end}
                    disabled={!d.enabled}
                    required={d.enabled}
                    onChange={(e) => update(day, { end: e.target.value })}
                    className={timeClass}
                  />
                  {!d.enabled && <span className="text-xs text-outline">Off</span>}
                </div>
              );
            })}
          </div>

          {error && (
            <p className="text-sm text-error bg-error-container/40 rounded-lg px-3 py-2">{error}</p>
          )}
          {notice && !dirty && <p className="text-sm text-secondary">{notice}</p>}

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || saved === null || !dirty}
              className="bg-secondary text-on-secondary font-label-caps text-label-caps px-8 py-3 rounded-full hover:bg-secondary/90 transition-colors disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save hours"}
            </button>
            {dirty && (
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setDays(toDays(saved ?? []));
                  setError(null);
                }}
                className="text-sm font-semibold text-on-surface-variant hover:underline disabled:opacity-50"
              >
                Discard changes
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
