// Simple underline tab bar. `count` renders as a small pill after the label.
export default function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string; count?: number }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="tablist" className="flex gap-6 border-b border-outline-variant/60">
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`-mb-px pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              selected
                ? "border-secondary text-primary"
                : "border-transparent text-on-surface-variant hover:text-primary"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  selected
                    ? "bg-secondary text-on-secondary"
                    : "bg-surface-variant text-on-surface-variant"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
