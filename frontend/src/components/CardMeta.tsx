import clsx from "clsx";
import { PRIORITIES, type Priority } from "@/lib/kanban";

const PRIORITY_STYLES: Record<Priority, string> = {
  low: "bg-[rgba(32,157,215,0.12)] text-[var(--primary-blue)]",
  medium: "bg-[rgba(236,173,10,0.16)] text-[#8a6400]",
  high: "bg-[rgba(117,57,145,0.14)] text-[var(--secondary-purple)]",
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const isOverdue = (dueDate: string): boolean => {
  const today = new Date().toISOString().slice(0, 10);
  return dueDate < today;
};

// Locale-independent so the rendered label is deterministic across environments.
const formatDueDate = (dueDate: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate);
  if (!match) {
    return dueDate;
  }
  const [, year, month, day] = match;
  const monthLabel = MONTHS[Number(month) - 1] ?? month;
  return `${Number(day)} ${monthLabel} ${year}`;
};

type CardMetaBadgesProps = {
  priority?: Priority | null;
  dueDate?: string | null;
};

export const CardMetaBadges = ({ priority, dueDate }: CardMetaBadgesProps) => {
  if (!priority && !dueDate) {
    return null;
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {priority && (
        <span
          className={clsx(
            "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]",
            PRIORITY_STYLES[priority]
          )}
        >
          {priority}
        </span>
      )}
      {dueDate && (
        <span
          className={clsx(
            "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]",
            isOverdue(dueDate)
              ? "bg-[rgba(117,57,145,0.14)] text-[var(--secondary-purple)]"
              : "bg-[var(--surface-strong)] text-[var(--gray-text)]"
          )}
        >
          {`Due ${formatDueDate(dueDate)}`}
        </span>
      )}
    </div>
  );
};

type CardMetaFieldsProps = {
  priority: Priority | null;
  dueDate: string | null;
  onPriorityChange: (priority: Priority | null) => void;
  onDueDateChange: (dueDate: string | null) => void;
};

const fieldClass =
  "w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]";

export const CardMetaFields = ({
  priority,
  dueDate,
  onPriorityChange,
  onDueDateChange,
}: CardMetaFieldsProps) => (
  <div className="flex gap-3">
    <label className="flex-1 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)]">
      Priority
      <select
        value={priority ?? ""}
        onChange={(event) =>
          onPriorityChange((event.target.value || null) as Priority | null)
        }
        aria-label="Card priority"
        className={clsx(fieldClass, "mt-1")}
      >
        <option value="">None</option>
        {PRIORITIES.map((value) => (
          <option key={value} value={value}>
            {value[0].toUpperCase() + value.slice(1)}
          </option>
        ))}
      </select>
    </label>
    <label className="flex-1 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)]">
      Due date
      <input
        type="date"
        value={dueDate ?? ""}
        onChange={(event) => onDueDateChange(event.target.value || null)}
        aria-label="Card due date"
        className={clsx(fieldClass, "mt-1")}
      />
    </label>
  </div>
);
