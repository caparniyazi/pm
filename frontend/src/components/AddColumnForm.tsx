import { useState, type FormEvent } from "react";
import { PlusIcon } from "@/components/icons";

type AddColumnFormProps = {
  onAdd: (title: string) => void;
  disabled?: boolean;
};

export const AddColumnForm = ({ onAdd, disabled }: AddColumnFormProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }
    onAdd(trimmed);
    setTitle("");
    setIsOpen(false);
  };

  if (disabled) {
    return null;
  }

  return (
    <div className="w-[220px] shrink-0">
      {isOpen ? (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-2 rounded-3xl border border-dashed border-[var(--stroke)] bg-[var(--surface-strong)] p-4"
        >
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Column title"
            aria-label="New column title"
            className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
            autoFocus
            required
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-full bg-[var(--secondary-purple)] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
            >
              Add column
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setTitle("");
              }}
              className="rounded-full border border-[var(--stroke)] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex h-full min-h-[120px] w-full items-center justify-center gap-1.5 rounded-3xl border border-dashed border-[var(--stroke)] px-3 py-4 text-xs font-semibold uppercase tracking-wide text-[var(--primary-blue)] transition hover:border-[var(--primary-blue)]"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Add column
        </button>
      )}
    </div>
  );
};
