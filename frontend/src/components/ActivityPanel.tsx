import { useState } from "react";
import type { ActivityEntry } from "@/lib/api";
import { formatTimestamp } from "@/lib/datetime";

type ActivityPanelProps = {
  activity: ActivityEntry[];
};

export const ActivityPanel = ({ activity }: ActivityPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="rounded-2xl border border-[var(--stroke)] bg-white/70 px-5 py-3"
      data-testid="activity-panel"
    >
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
      >
        Activity
        <span className="rounded-full bg-[var(--surface-strong)] px-2 py-0.5 text-[var(--primary-blue)]">
          {activity.length}
        </span>
      </button>

      {isOpen && (
        <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
          {activity.length === 0 && (
            <li className="text-sm text-[var(--gray-text)]">No activity yet.</li>
          )}
          {activity.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-0.5 border-l-2 border-[var(--accent-yellow)] pl-3"
            >
              <span className="text-sm text-[var(--navy-dark)]">{entry.summary}</span>
              <span className="text-[10px] uppercase tracking-wide text-[var(--gray-text)]">
                {formatTimestamp(entry.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
