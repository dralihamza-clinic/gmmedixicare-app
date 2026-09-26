import { useState, type FormEvent } from "react";
import { deleteDoctor, updateDoctor } from "../lib/doctors";
import Modal from "./Modal";

const CONFIRM_WORD = "delete";

// Permanent delete, gated on typing the confirmation word: a stray click or
// an OK on a browser confirm() isn't enough for something that can't be undone.
function DeleteDoctorDialog({
  name,
  onCancel,
  onConfirm,
}: {
  name: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmed = typed.trim().toLowerCase() === CONFIRM_WORD;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!confirmed) return;
    setError(null);
    setDeleting(true);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete the doctor.");
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-on-surface">
        This permanently deletes <span className="font-bold text-primary">{name}</span>. This
        can't be undone.
      </p>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-primary">
        <span>
          Type <span className="font-mono text-error">{CONFIRM_WORD}</span> to confirm
        </span>
        <input
          value={typed}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setTyped(e.target.value)}
          className="rounded-lg border border-outline-variant px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-error"
        />
      </label>
      {error && (
        <p className="text-sm text-error bg-error-container/40 rounded-lg px-3 py-2">{error}</p>
      )}
      <div className="flex justify-end items-center gap-4 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={deleting}
          className="text-sm font-semibold text-on-surface-variant hover:underline disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!confirmed || deleting}
          className="bg-error text-on-error font-label-caps text-label-caps px-6 py-2.5 rounded-full hover:bg-error/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {deleting ? "Deleting…" : "Delete permanently"}
        </button>
      </div>
    </form>
  );
}

// Row actions on the Doctors page: Deactivate for active doctors; Activate
// and Delete for deactivated ones.
export default function DoctorRowActions({
  id,
  name,
  active,
  onChanged,
  onError,
}: {
  id: string;
  name: string;
  active: boolean;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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

  if (active) {
    return (
      <button
        disabled={pending}
        onClick={() => void run(() => updateDoctor(id, { active: false }))}
        className="text-sm font-semibold text-secondary hover:underline disabled:opacity-50"
      >
        Deactivate
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        disabled={pending}
        onClick={() => void run(() => updateDoctor(id, { active: true }))}
        className="text-sm font-semibold text-secondary hover:underline disabled:opacity-50"
      >
        Activate
      </button>
      <button
        disabled={pending}
        onClick={() => setConfirmingDelete(true)}
        className="text-sm font-semibold text-error hover:underline disabled:opacity-50"
      >
        Delete
      </button>

      <Modal open={confirmingDelete} onClose={() => setConfirmingDelete(false)} title="Delete doctor">
        <DeleteDoctorDialog
          name={name}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={async () => {
            await deleteDoctor(id);
            setConfirmingDelete(false);
            onChanged();
          }}
        />
      </Modal>
    </div>
  );
}
