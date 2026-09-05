import { useState, type FormEvent } from "react";
import { PlusIcon } from "@/components/icons";
import { CardMetaFields, LabelEditor } from "@/components/CardMeta";
import { normalizeLabels, type CardFields, type Priority } from "@/lib/kanban";

const initialFormState = {
  title: "",
  details: "",
  priority: null as Priority | null,
  dueDate: null as string | null,
  labels: [] as string[],
};

type NewCardFormProps = {
  onAdd: (fields: CardFields) => void;
};

export const NewCardForm = ({ onAdd }: NewCardFormProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [formState, setFormState] = useState(initialFormState);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.title.trim()) {
      return;
    }
    onAdd({
      title: formState.title.trim(),
      details: formState.details.trim(),
      priority: formState.priority,
      dueDate: formState.dueDate,
      labels: normalizeLabels(formState.labels),
    });
    setFormState(initialFormState);
    setIsOpen(false);
  };

  return (
    <div className="mt-4">
      {isOpen ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={formState.title}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, title: event.target.value }))
            }
            placeholder="Card title"
            className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
            required
          />
          <textarea
            value={formState.details}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, details: event.target.value }))
            }
            placeholder="Details"
            rows={3}
            className="w-full resize-none rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--gray-text)] outline-none transition focus:border-[var(--primary-blue)]"
          />
          <CardMetaFields
            priority={formState.priority}
            dueDate={formState.dueDate}
            onPriorityChange={(priority) =>
              setFormState((prev) => ({ ...prev, priority }))
            }
            onDueDateChange={(dueDate) =>
              setFormState((prev) => ({ ...prev, dueDate }))
            }
          />
          <LabelEditor
            labels={formState.labels}
            onChange={(labels) => setFormState((prev) => ({ ...prev, labels }))}
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
            >
              Add card
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setFormState(initialFormState);
              }}
              className="rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-full border border-dashed border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--primary-blue)] transition hover:border-[var(--primary-blue)]"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Add a card
        </button>
      )}
    </div>
  );
};
