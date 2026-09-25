import { useState } from "react";

// Shows the doctor's photo, or their initials when there is no photo / it
// can't be loaded (offline, broken link) — no external fallback image needed.
export default function DoctorAvatar({
  name,
  src,
}: {
  name: string;
  src: string | null;
}) {
  const [failed, setFailed] = useState(false);

  const initials = name
    .replace(/^dr\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-variant shrink-0 flex items-center justify-center">
      {src && !failed ? (
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-sm font-bold text-on-surface-variant">
          {initials || "?"}
        </span>
      )}
    </div>
  );
}
