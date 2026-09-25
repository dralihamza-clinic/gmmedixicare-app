import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { useAppointmentNotifications } from "../components/AppointmentNotifications";
import Icon from "../components/Icon";
import {
  formatPreferredSlot,
  listAppointments,
  updateAppointmentStatus,
} from "../lib/appointments";
import type { AppointmentStatus, AppointmentWithDoctor } from "../lib/types";

const STATUS_STYLES: Record<AppointmentStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-tertiary-fixed/60 text-on-tertiary-fixed-variant" },
  confirmed: { label: "Confirmed", className: "bg-secondary-fixed/30 text-on-secondary-fixed-variant" },
  rejected: { label: "Rejected", className: "bg-error-container text-on-error-container" },
  rescheduled: { label: "Rescheduled", className: "bg-primary-fixed text-on-primary-fixed-variant" },
};

function todayLocal() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function RescheduleForm({
  appointment,
  onCancel,
  onSubmit,
  pending,
}: {
  appointment: AppointmentWithDoctor;
  onCancel: () => void;
  onSubmit: (date: string, time: string, staffNote: string) => void;
  pending: boolean;
}) {
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    onSubmit(
      String(data.get("date") ?? ""),
      String(data.get("time") ?? ""),
      String(data.get("staff_note") ?? "")
    );
  }

  const inputClass =
    "rounded-lg border-outline-variant bg-surface-container-lowest text-sm focus:border-secondary focus:ring-secondary";

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 p-4 rounded-lg bg-surface-container-low border border-outline-variant/60 grid grid-cols-2 gap-3"
    >
      <label className="flex flex-col gap-1 text-xs font-semibold text-primary">
        New date
        <input
          type="date"
          name="date"
          required
          min={todayLocal()}
          defaultValue={appointment.preferred_date}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-primary">
        New time
        <input
          type="time"
          name="time"
          required
          defaultValue={appointment.preferred_time}
          className={inputClass}
        />
      </label>
      <label className="col-span-2 flex flex-col gap-1 text-xs font-semibold text-primary">
        Note for staff (optional)
        <textarea
          name="staff_note"
          rows={2}
          defaultValue={appointment.staff_note ?? ""}
          placeholder="e.g. Doctor unavailable Tuesday — patient agreed by phone"
          className={inputClass}
        />
      </label>
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
          {pending ? "Saving…" : "Save Reschedule"}
        </button>
      </div>
    </form>
  );
}

function AppointmentRow({
  appointment: a,
  showDoctor,
  onChanged,
  onError,
}: {
  appointment: AppointmentWithDoctor;
  showDoctor: boolean;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const status = STATUS_STYLES[a.status];

  async function run(action: () => Promise<void>) {
    setPending(true);
    try {
      await action();
      setRescheduling(false);
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="p-5">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-primary">{a.patient_name}</p>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.className}`}>
              {status.label}
            </span>
          </div>
          <p className="text-sm text-on-surface-variant flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1">
              <Icon name="call" className="text-base" />
              {a.patient_phone}
            </span>
            {a.patient_email && (
              <span className="flex items-center gap-1">
                <Icon name="mail" className="text-base" />
                {a.patient_email}
              </span>
            )}
          </p>
          <p className="text-sm text-primary flex items-center gap-1 font-semibold">
            <Icon name="event" className="text-base text-secondary" />
            {formatPreferredSlot(a.preferred_date, a.preferred_time)}
            {showDoctor && a.doctor && (
              <span className="font-normal text-on-surface-variant">
                {" "}· with {a.doctor.name}
              </span>
            )}
          </p>
          {a.notes && (
            <p className="text-sm text-on-surface-variant mt-1 whitespace-pre-line">
              <span className="font-semibold text-primary">Patient notes: </span>
              {a.notes}
            </p>
          )}
          {a.staff_note && (
            <p className="text-sm text-on-surface-variant whitespace-pre-line">
              <span className="font-semibold text-primary">Staff note: </span>
              {a.staff_note}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {a.status !== "confirmed" && (
            <button
              disabled={pending}
              onClick={() => void run(() => updateAppointmentStatus(a.id, "confirmed"))}
              className="text-sm font-semibold text-secondary hover:underline disabled:opacity-50"
            >
              Confirm
            </button>
          )}
          <button
            disabled={pending}
            onClick={() => setRescheduling((r) => !r)}
            className="text-sm font-semibold text-primary hover:underline disabled:opacity-50"
          >
            Reschedule
          </button>
          {a.status !== "rejected" && (
            <button
              disabled={pending}
              onClick={() => {
                if (window.confirm(`Reject ${a.patient_name}'s appointment request?`)) {
                  void run(() => updateAppointmentStatus(a.id, "rejected"));
                }
              }}
              className="text-sm font-semibold text-error hover:underline disabled:opacity-50"
            >
              Reject
            </button>
          )}
        </div>
      </div>

      {rescheduling && (
        <RescheduleForm
          appointment={a}
          pending={pending}
          onCancel={() => setRescheduling(false)}
          onSubmit={(date, time, staffNote) =>
            void run(() =>
              updateAppointmentStatus(a.id, "rescheduled", staffNote, { date, time })
            )
          }
        />
      )}
    </div>
  );
}

export default function AppointmentsPage() {
  const { staff } = useAuth();
  const { setViewingPage, onNewAppointment } = useAppointmentNotifications();
  const [appointments, setAppointments] = useState<AppointmentWithDoctor[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setAppointments(await listAppointments());
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

  const pendingCount = appointments?.filter((a) => a.status === "pending").length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">Appointments</h1>
          {appointments && appointments.length > 0 && (
            <p className="text-sm text-on-surface-variant mt-1">
              {pendingCount} pending · {appointments.length} total
            </p>
          )}
        </div>
        <button
          onClick={() => void load()}
          className="text-sm font-semibold text-secondary hover:underline flex items-center gap-1"
        >
          <Icon name="refresh" className="text-lg" />
          Refresh
        </button>
      </div>

      {error && <p className="text-error text-sm">{error}</p>}

      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-variant divide-y divide-outline-variant/40">
        {appointments === null && (
          <p className="p-6 text-on-surface-variant text-sm">Loading…</p>
        )}
        {appointments?.length === 0 && (
          <p className="p-6 text-on-surface-variant text-sm">
            No appointment requests yet. New ones from the website will appear here.
          </p>
        )}
        {appointments?.map((appointment) => (
          <AppointmentRow
            key={appointment.id}
            appointment={appointment}
            showDoctor={staff?.role === "admin"}
            onChanged={() => void load()}
            onError={setError}
          />
        ))}
      </div>
    </div>
  );
}
