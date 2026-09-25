import { formatPreferredSlot } from "../lib/appointments";
import type { AppointmentStatus, AppointmentWithDoctor } from "../lib/types";
import Icon from "./Icon";

const STATUS_STYLES: Record<AppointmentStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-tertiary-fixed/60 text-on-tertiary-fixed-variant" },
  confirmed: { label: "Confirmed", className: "bg-secondary-fixed/30 text-on-secondary-fixed-variant" },
  done: { label: "Done", className: "bg-secondary text-on-secondary" },
  missed: { label: "Missed", className: "bg-tertiary-fixed-dim/60 text-on-tertiary-fixed" },
  rejected: { label: "Rejected", className: "bg-error-container text-on-error-container" },
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  // Unknown values (e.g. a legacy 'rescheduled' row) still render readably.
  const style = STATUS_STYLES[status] ?? {
    label: status,
    className: "bg-surface-variant text-on-surface-variant",
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${style.className}`}>
      {style.label}
    </span>
  );
}

// Read-only summary of one appointment, shared by the Appointments and
// History pages. Actions are rendered by the page beside it.
export default function AppointmentDetails({
  appointment: a,
  showDoctor,
}: {
  appointment: AppointmentWithDoctor;
  showDoctor: boolean;
}) {
  return (
    <div className="flex-1 min-w-0 flex flex-col gap-1">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="font-bold text-primary">{a.patient_name}</p>
        <StatusBadge status={a.status} />
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
  );
}
