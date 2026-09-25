import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppointmentNotifications } from "./AppointmentNotifications";
import { formatPreferredSlot } from "../lib/appointments";
import Icon from "./Icon";

const MAX_LISTED = 8;

// Sidebar bell: badge = appointments since the Appointments page was last
// viewed. The dropdown opens upward since the bell sits at the sidebar's foot.
export default function NotificationBell() {
  const { unseen } = useAppointmentNotifications();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function goToAppointments() {
    setOpen(false);
    navigate("/appointments");
  }

  const count = unseen.length;
  const label =
    count === 0
      ? "Notifications"
      : `${count} new appointment request${count === 1 ? "" : "s"}`;

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="true"
        title={label}
        className="relative w-9 h-9 rounded-full flex items-center justify-center text-on-primary-container/80 hover:text-secondary-fixed hover:bg-on-primary/10 transition-colors"
      >
        <Icon name="notifications" className="text-xl" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-error text-on-error text-[10px] font-bold leading-[18px] text-center">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-80 z-50 bg-surface-container-lowest text-on-surface rounded-xl shadow-xl border border-surface-variant overflow-hidden">
          <div className="px-4 py-3 border-b border-outline-variant/40">
            <p className="font-bold text-primary text-sm">New appointment requests</p>
          </div>

          {count === 0 ? (
            <p className="px-4 py-6 text-sm text-on-surface-variant text-center">
              You're all caught up.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-outline-variant/40">
              {unseen.slice(0, MAX_LISTED).map((a) => (
                <li key={a.id}>
                  <button
                    onClick={goToAppointments}
                    className="w-full text-left px-4 py-3 hover:bg-surface-container-low transition-colors flex gap-3"
                  >
                    <Icon name="event" className="text-lg text-secondary mt-0.5" />
                    <span className="min-w-0">
                      <span className="block font-semibold text-primary text-sm truncate">
                        {a.patient_name}
                      </span>
                      <span className="block text-xs text-on-surface-variant">
                        {formatPreferredSlot(a.preferred_date, a.preferred_time)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={goToAppointments}
            className="w-full px-4 py-2.5 border-t border-outline-variant/40 text-sm font-semibold text-secondary hover:bg-surface-container-low transition-colors"
          >
            {count > MAX_LISTED
              ? `View all ${count} in Appointments`
              : "Go to Appointments"}
          </button>
        </div>
      )}
    </div>
  );
}
