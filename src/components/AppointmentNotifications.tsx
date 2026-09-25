import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { listAppointments, subscribeToNewAppointments } from "../lib/appointments";
import { playChime } from "../lib/chime";
import type { Appointment } from "../lib/types";

interface AppointmentNotificationsState {
  /** Appointments created since this user last viewed the Appointments page, newest first. */
  unseen: Appointment[];
  /** Called by AppointmentsPage while it's on screen: clears the badge and keeps it clear. */
  setViewingPage: (viewing: boolean) => void;
  /** Lets AppointmentsPage add live inserts to its list without a second Realtime channel. */
  onNewAppointment: (listener: (appointment: Appointment) => void) => () => void;
}

const AppointmentNotificationsContext =
  createContext<AppointmentNotificationsState | null>(null);

// Per user, so two staff sharing a PC each get their own "last viewed".
function storageKey(userId: string) {
  return `gmmedixicare:appointments-last-viewed:${userId}`;
}

function readLastViewed(userId: string): string {
  const saved = localStorage.getItem(storageKey(userId));
  if (saved) return saved;
  // First run on this machine: start from now rather than flagging every
  // historical appointment as new.
  const now = new Date().toISOString();
  localStorage.setItem(storageKey(userId), now);
  return now;
}

// Owns the single Realtime subscription for the signed-in session. Mounted
// by DashboardLayout, so it lives exactly as long as a staff user is signed in.
export function AppointmentNotificationsProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const [unseen, setUnseen] = useState<Appointment[]>([]);
  const viewingRef = useRef(false);
  const listenersRef = useRef(new Set<(appointment: Appointment) => void>());

  const markViewed = useCallback(() => {
    localStorage.setItem(storageKey(userId), new Date().toISOString());
    setUnseen([]);
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    // Subscribe before the catch-up fetch so nothing inserted in between is
    // missed; the id check below drops the overlap.
    const unsubscribe = subscribeToNewAppointments((appointment) => {
      if (cancelled) return;
      playChime();
      listenersRef.current.forEach((listener) => listener(appointment));
      if (viewingRef.current) {
        markViewed();
        return;
      }
      setUnseen((prev) =>
        prev.some((a) => a.id === appointment.id) ? prev : [appointment, ...prev]
      );
    });

    // Catch up on requests that arrived while the app was closed.
    listAppointments({ createdAfter: readLastViewed(userId) })
      .then((missed) => {
        if (cancelled || viewingRef.current) return;
        setUnseen((prev) => {
          const known = new Set(prev.map((a) => a.id));
          return [...prev, ...missed.filter((a) => !known.has(a.id))];
        });
      })
      .catch((err) => {
        console.error("Couldn't load new appointments:", err);
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [userId, markViewed]);

  const setViewingPage = useCallback(
    (viewing: boolean) => {
      viewingRef.current = viewing;
      if (viewing) markViewed();
    },
    [markViewed]
  );

  const onNewAppointment = useCallback(
    (listener: (appointment: Appointment) => void) => {
      listenersRef.current.add(listener);
      return () => {
        listenersRef.current.delete(listener);
      };
    },
    []
  );

  const value = useMemo<AppointmentNotificationsState>(
    () => ({ unseen, setViewingPage, onNewAppointment }),
    [unseen, setViewingPage, onNewAppointment]
  );

  return (
    <AppointmentNotificationsContext.Provider value={value}>
      {children}
    </AppointmentNotificationsContext.Provider>
  );
}

export function useAppointmentNotifications(): AppointmentNotificationsState {
  const ctx = useContext(AppointmentNotificationsContext);
  if (!ctx) {
    throw new Error(
      "useAppointmentNotifications must be used inside <AppointmentNotificationsProvider>"
    );
  }
  return ctx;
}
