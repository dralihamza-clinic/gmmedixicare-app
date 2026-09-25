import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const inputClass =
  "rounded-lg border border-outline-variant px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary";

export default function LoginPage() {
  const { session, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Already signed in (or just signed in): DashboardLayout takes over.
  if (session) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const message = await signIn(email.trim(), password);
    setLoading(false);
    if (message) setError(message);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface-container-low px-gutter py-10">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-surface-container-lowest rounded-2xl shadow-sm border border-surface-variant p-8 flex flex-col gap-5"
      >
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">
            Staff Sign In
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            For clinic admins and doctors.
          </p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-primary">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-primary">Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>

        {error && (
          <p className="text-sm text-error bg-error-container/40 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="bg-secondary text-on-secondary font-label-caps text-label-caps py-3 rounded-full hover:bg-secondary/90 transition-colors disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </main>
  );
}
