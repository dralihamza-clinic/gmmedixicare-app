import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { useAppointmentNotifications } from "../components/AppointmentNotifications";
import AppointmentDetails from "../components/AppointmentDetails";
import CompleteAppointmentModal from "../components/CompleteAppointmentModal";
import Icon from "../components/Icon";
import Tabs from "../components/Tabs";
import {
  listAppointments,
  markAppointmentMissed,
  rescheduleAppointment,
  slotToDate,
  todayLocal,
  updateAppointmentStatus,
} from "../lib/appointments";
import type { AppointmentWithDoctor } from "../lib/types";

type TabId = "pending" | "confirmed" | "needs-action";

const EMPTY_MESSAGES: Record<TabId, string> = {
  pending: "No pending requests. New ones from the website will appear here.",
  confirmed: "No upcoming confirmed appointments.",
  "needs-action": "Nothing to follow up. Confirmed appointments move here once their time has passed.",
};

const inputClass =
  "rounded-lg border-outline-variant bg-surface-container-lowest text-sm focus:border-secondary focus:ring-secondary";

function InlinePanel({
  onSubmit,
  onCancel,
  pending,
  submitLabel,
  children,
}: {
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
  pending: boolean;
  submitLabel: string;
  children: ReactNode;
}) {
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit(new FormData(e.currentTarget));
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 p-4 rounded-lg bg-surface-container-low border border-outline-variant/60 grid grid-cols-2 gap-3"
    >
      {children}
      <div className="col-span-2 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="text-sm font-semibold text-on-surface-variant hover:underline disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="bg-secondary text-on-secondary font-label-caps text-label-caps px-5 py-2 rounded-full hover:bg-secondary/90 transition-colors disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function AppointmentRow({
  appointment: a,
  tab,
  showDoctor,
  onChanged,
  onError,
}: {
  appointment: AppointmentWithDoctor;
  tab: TabId;
  showDoctor: boolean;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const [panel, setPanel] = useState<"reschedule" | "missed" | null>(null);
  const [completing, setCompleting] = useState(false);

  async function run(action: () => Promise<void>) {
    setPending(true);
    try {
      await action();
      setPanel(null);
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  const togglePanel = (next: "reschedule" | "missed") =>
    setPanel((current) => (current === next ? null : next));

  const linkButton = "text-sm font-semibold hover:underline disabled:opacity-50";

  return (
    <div className="p-5">
      <div className="flex items-start gap-4">
        <AppointmentDetails appointment={a} showDoctor={showDoctor} />

        <div className="flex items-center gap-3 shrink-0">
          {tab === "pending" && (
            <button
              disabled={pending}
              onClick={() => void run(() => updateAppointmentStatus(a.id, "confirmed"))}
              className={`${linkButton} text-secondary`}
            >
              Confirm
            </button>
          )}
          {(tab === "pending" || tab === "confirmed") && (
            <button
              disabled={pending}
              onClick={() => togglePanel("reschedule")}
              className={`${linkButton} text-primary`}
            >
              Reschedule
            </button>
          )}
          {tab === "pending" && (
            <button
              disabled={pending}
              onClick={() => {
                if (window.confirm(`Reject ${a.patient_name}'s appointment request?`)) {
                  void run(() => updateAppointmentStatus(a.id, "rejected"));
                }
              }}
              className={`${linkButton} text-error`}
            >
              Reject
            </button>
          )}
          {tab === "needs-action" && (
            <>
              <button
                disabled={pending}
                onClick={() => setCompleting(true)}
                className={`${linkButton} text-secondary`}
              >
                Mark Done
              </button>
              <button
                disabled={pending}
                onClick={() => togglePanel("missed")}
                className={`${linkButton} text-error`}
              >
                Mark Missed
              </button>
            </>
          )}
        </div>
      </div>

      {panel === "reschedule" && (
        <InlinePanel
          pending={pending}
          submitLabel="Save Reschedule"
          onCancel={() => setPanel(null)}
          onSubmit={(data) =>
            void run(() =>
              rescheduleAppointment(
                a,
                { date: String(data.get("date") ?? ""), time: String(data.get("time") ?? "") },
                String(data.get("note") ?? "")
              )
            )
          }
        >
          <label className="flex flex-col gap-1 text-xs font-semibold text-primary">
            New date
            <input
              type="date"
              name="date"
              required
              min={todayLocal()}
              defaultValue={a.preferred_date}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-primary">
            New time
            <input
              type="time"
              name="time"
              required
              defaultValue={a.preferred_time}
              className={inputClass}
            />
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-xs font-semibold text-primary">
            Reason (optional)
            <textarea
              name="note"
              rows={2}
              placeholder="e.g. Doctor unavailable — patient agreed by phone"
              className={inputClass}
            />
            <span className="font-normal text-on-surface-variant">
              The current date and time are saved to the staff note automatically.
            </span>
          </label>
        </InlinePanel>
      )}

      {completing && (
        <CompleteAppointmentModal
          appointment={a}
          open={completing}
          onClose={() => setCompleting(false)}
          onDone={() => {
            setCompleting(false);
            onChanged();
          }}
        />
      )}

      {panel === "missed" && (
        <InlinePanel
          pending={pending}
          submitLabel="Mark Missed"
          onCancel={() => setPanel(null)}
          onSubmit={(data) =>
            void run(() => markAppointmentMissed(a, String(data.get("reason") ?? "")))
          }
        >
          <label className="col-span-2 flex flex-col gap-1 text-xs font-semibold text-primary">
            Reason (required)
            <textarea
              name="reason"
              rows={2}
              required
              placeholder="e.g. Patient didn't show up and couldn't be reached"
              className={inputClass}
            />
          </label>
        </InlinePanel>
      )}
    </div>
  );
}

// Current time, refreshed every minute so a confirmed appointment moves to
// Needs Action on its own once its slot passes.
function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

const bySlot = (a: AppointmentWithDoctor, b: AppointmentWithDoctor) =>
  slotToDate(a.preferred_date, a.preferred_time).getTime() -
  slotToDate(b.preferred_date, b.preferred_time).getTime();

export default function AppointmentsPage() {
  const { staff } = useAuth();
  const { setViewingPage, onNewAppointment } = useAppointmentNotifications();
  const [appointments, setAppointments] = useState<AppointmentWithDoctor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("pending");
  const now = useNow();

  const load = useCallback(async () => {
    try {
      setAppointments(await listAppointments({ statuses: ["pending", "confirmed"] }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load appointments.");
      setAppointments((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // While this page is open the bell stays cleared, and new requests appear
  // here live. Reload (rather than prepend the Realtime row) to pick up the
  // doctor's name, which the Realtime payload doesn't include.
  useEffect(() => {
    setViewingPage(true);
    const unsubscribe = onNewAppointment(() => void load());
    return () => {
      setViewingPage(false);
      unsubscribe();
    };
  }, [setViewingPage, onNewAppointment, load]);

  const groups = useMemo(() => {
    const result: Record<TabId, AppointmentWithDoctor[]> = {
      pending: [],
      confirmed: [],
      "needs-action": [],
    };
    for (const a of appointments ?? []) {
      if (a.status === "pending") {
        result.pending.push(a);
      } else if (a.status === "confirmed") {
        const past = slotToDate(a.preferred_date, a.preferred_time) <= now;
        result[past ? "needs-action" : "confirmed"].push(a);
      }
    }
    // Soonest first; for Needs Action that means the longest-overdue first.
    Object.values(result).forEach((list) => list.sort(bySlot));
    return result;
  }, [appointments, now]);

  const rows = groups[tab];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-headline-md text-headline-md text-primary">Appointments</h1>
        <button
          onClick={() => void load()}
          className="text-sm font-semibold text-secondary hover:underline flex items-center gap-1"
        >
          <Icon name="refresh" className="text-lg" />
          Refresh
        </button>
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "pending", label: "Pending", count: groups.pending.length },
          { id: "confirmed", label: "Confirmed", count: groups.confirmed.length },
          { id: "needs-action", label: "Needs Action", count: groups["needs-action"].length },
        ]}
      />

      {error && <p className="text-error text-sm">{error}</p>}

      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-variant divide-y divide-outline-variant/40">
        {appointments === null && (
          <p className="p-6 text-on-surface-variant text-sm">Loading…</p>
        )}
        {appointments !== null && rows.length === 0 && (
          <p className="p-6 text-on-surface-variant text-sm">{EMPTY_MESSAGES[tab]}</p>
        )}
        {rows.map((appointment) => (
          <AppointmentRow
            key={appointment.id}
            appointment={appointment}
            tab={tab}
            showDoctor={staff?.role === "admin"}
            onChanged={() => void load()}
            onError={setError}
          />
        ))}
      </div>
    </div>
  );
}
