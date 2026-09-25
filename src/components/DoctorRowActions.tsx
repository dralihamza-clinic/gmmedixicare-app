import { useState } from "react";
import { deleteDoctor, updateDoctor } from "../lib/doctors";

export default function DoctorRowActions({
  id,
  active,
  onChanged,
  onError,
}: {
  id: string;
  active: boolean;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [pending, setPending] = useState(false);

  async function run(action: () => Promise<void>) {
    setPending(true);
    try {
      await action();
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        disabled={pending}
        onClick={() => void run(() => updateDoctor(id, { active: !active }))}
        className="text-sm font-semibold text-secondary hover:underline disabled:opacity-50"
      >
        {active ? "Deactivate" : "Activate"}
      </button>
      <button
        disabled={pending}
        onClick={() => {
          if (window.confirm("Delete this doctor permanently? This can't be undone.")) {
            void run(() => deleteDoctor(id));
          }
        }}
        className="text-sm font-semibold text-error hover:underline disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}
