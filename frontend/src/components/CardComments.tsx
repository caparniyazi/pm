import { useState, type FormEvent } from "react";
import type { Comment } from "@/lib/api";
import { formatTimestamp } from "@/lib/datetime";

type CardCommentsProps = {
  comments: Comment[];
  currentUsername?: string;
  onAdd: (body: string) => Promise<void> | void;
  onDelete: (commentId: string) => Promise<void> | void;
};

export const CardComments = ({
  comments,
  currentUsername,
  onAdd,
  onDelete,
}: CardCommentsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || busy) {
      return;
    }
    setBusy(true);
    try {
      await onAdd(body);
      setDraft("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 border-t border-[var(--stroke)] pt-2">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="text-xs font-semibold uppercase tracking-wide text-[var(--primary-blue)] transition hover:text-[var(--secondary-purple)]"
      >
        {comments.length === 0
          ? "Add comment"
          : `Comments (${comments.length})`}
      </button>

      {isOpen && (
        <div className="mt-2 space-y-2">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-xl bg-[var(--surface-strong)] px-3 py-2"
              data-testid={`comment-${comment.id}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-[var(--navy-dark)]">
                  {comment.author}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-[var(--gray-text)]">
                  {formatTimestamp(comment.createdAt)}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--gray-text)]">
                {comment.body}
              </p>
              {comment.author === currentUsername && (
                <button
                  type="button"
                  onClick={() => onDelete(comment.id)}
                  className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--secondary-purple)]"
                  aria-label={`Delete comment by ${comment.author}`}
                >
                  Delete
                </button>
              )}
            </div>
          ))}

          <form onSubmit={handleSubmit} className="space-y-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-label="New comment"
              rows={2}
              placeholder="Write a comment"
              className="w-full resize-none rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="rounded-full bg-[var(--secondary-purple)] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Comment
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
