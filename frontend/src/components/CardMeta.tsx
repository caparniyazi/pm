import { useState, type KeyboardEvent } from "react";
import clsx from "clsx";
import {
  MAX_LABELS_PER_CARD,
  MAX_LABEL_LENGTH,
  normalizeLabels,
  PRIORITIES,
  type Priority,
} from "@/lib/kanban";

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

const chipClass =
  "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]";

type LabelChipsProps = {
  labels: string[];
  activeLabels?: readonly string[];
  onToggle?: (label: string) => void;
  className?: string;
};

export const LabelChips = ({
  labels,
  activeLabels,
  onToggle,
  className,
}: LabelChipsProps) => {
  if (labels.length === 0) {
    return null;
  }
  const active = new Set(activeLabels ?? []);
  return (
    <div className={clsx("flex flex-wrap items-center gap-1.5", className)}>
      {labels.map((label) => {
        const isActive = active.has(label);
        const style = clsx(
          chipClass,
          isActive
            ? "bg-[var(--primary-blue)] text-white"
            : "bg-[rgba(32,157,215,0.12)] text-[var(--primary-blue)]"
        );
        if (!onToggle) {
          return (
            <span key={label} className={style}>
              {label}
            </span>
          );
        }
        return (
          <button
            key={label}
            type="button"
            onClick={() => onToggle(label)}
            aria-pressed={isActive}
            className={clsx(style, "transition hover:brightness-105")}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};

type LabelEditorProps = {
  labels: string[];
  onChange: (labels: string[]) => void;
};

export const LabelEditor = ({ labels, onChange }: LabelEditorProps) => {
  const [draft, setDraft] = useState("");

  const addDraft = () => {
    const next = normalizeLabels([...labels, draft]);
    if (next.length !== labels.length) {
      onChange(next);
    }
    setDraft("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addDraft();
    } else if (event.key === "Backspace" && !draft && labels.length > 0) {
      onChange(labels.slice(0, -1));
    }
  };

  return (
    <div className="text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)]">
      Labels
      <div className="mt-1 flex flex-wrap items-center gap-1.5 rounded-xl border border-[var(--stroke)] bg-white px-2 py-2">
        {labels.map((label) => (
          <span
            key={label}
            className={clsx(
              chipClass,
              "flex items-center gap-1 bg-[rgba(32,157,215,0.12)] text-[var(--primary-blue)]"
            )}
          >
            {label}
            <button
              type="button"
              onClick={() => onChange(labels.filter((item) => item !== label))}
              aria-label={`Remove label ${label}`}
              className="leading-none text-[var(--primary-blue)] hover:text-[var(--secondary-purple)]"
            >
              &times;
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, MAX_LABEL_LENGTH))}
          onKeyDown={handleKeyDown}
          onBlur={addDraft}
          disabled={labels.length >= MAX_LABELS_PER_CARD}
          placeholder={labels.length === 0 ? "Add a label" : ""}
          aria-label="Add label"
          className="min-w-[6rem] flex-1 bg-transparent px-1 py-0.5 text-xs font-medium normal-case tracking-normal text-[var(--navy-dark)] outline-none disabled:cursor-not-allowed"
        />
      </div>
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
