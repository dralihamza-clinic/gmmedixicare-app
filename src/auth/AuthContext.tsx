import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { StaffProfile, StaffRole } from "../lib/types";

interface AuthState {
  /** True until the saved session and the staff role have both been resolved. */
  loading: boolean;
  session: Session | null;
  /** null when signed out OR signed in without a row in user_roles. */
  staff: StaffProfile | null;
  /** Error message if the role lookup itself failed (e.g. network). */
  staffError: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [staff, setStaff] = useState<StaffProfile | null>(null);
  const [staffError, setStaffError] = useState<string | null>(null);
  // Which user id the current `staff` value was resolved for.
  const [resolvedFor, setResolvedFor] = useState<string | null>(null);

  // 1. Restore the saved session and follow sign-in / sign-out / token refresh.
  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setSessionLoaded(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setSessionLoaded(true);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // 2. Whenever the signed-in *user* changes, look up their staff role.
  const userId = session?.user.id ?? null;
  const userEmail = session?.user.email ?? null;

  useEffect(() => {
    if (!sessionLoaded) return;

    if (!userId) {
      setStaff(null);
      setStaffError(null);
      setResolvedFor(null);
      return;
    }

    let cancelled = false;

    supabase
      .from("user_roles")
      .select("role, doctor_id")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setStaff(null);
          setStaffError(error.message);
        } else if (!data) {
          setStaff(null);
          setStaffError(null);
        } else {
          setStaff({
            userId,
            email: userEmail,
            role: data.role as StaffRole,
            doctorId: data.doctor_id,
          });
          setStaffError(null);
        }
        setResolvedFor(userId);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionLoaded, userId, userEmail]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const loading = !sessionLoaded || (userId !== null && resolvedFor !== userId);

  const value = useMemo<AuthState>(
    () => ({ loading, session, staff, staffError, signIn, signOut }),
    [loading, session, staff, staffError, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
