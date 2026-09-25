import { useEffect, useRef, type ReactNode } from "react";
import Icon from "./Icon";

// Controlled wrapper around the native <dialog> (focus trap + backdrop for
// free). Escape and backdrop clicks deliberately do NOT close it: these
// modals hold clinical notes, and losing them to a stray keypress is worse
// than an extra click on the close button.
export default function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => e.preventDefault()}
      className={`m-auto w-[calc(100%-4rem)] ${
        wide ? "max-w-4xl" : "max-w-xl"
      } max-h-[90vh] rounded-2xl bg-surface-container-lowest p-0 shadow-xl backdrop:bg-primary/60`}
    >
      {open && (
        <div className="flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-outline-variant/60">
            <h2 className="font-bold text-lg text-primary">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors"
            >
              <Icon name="close" />
            </button>
          </div>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}
