import { useState, type FormEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { normalizeLabels, type Card, type CardFields } from "@/lib/kanban";
import type { Comment } from "@/lib/api";
import {
  CardMetaBadges,
  CardMetaFields,
  LabelChips,
  LabelEditor,
} from "@/components/CardMeta";
import { CardComments } from "@/components/CardComments";
import { PencilIcon, TrashIcon } from "@/components/icons";

export type CardCommentsBridge = {
  commentsByCard: Record<string, Comment[]>;
  currentUsername?: string;
  onAddComment: (cardId: string, body: string) => Promise<void> | void;
  onDeleteComment?: (commentId: string) => Promise<void> | void;
};

type KanbanCardProps = {
  card: Card;
  onEdit: (cardId: string, fields: CardFields) => void;
  onDelete: (cardId: string) => void;
  cardComments?: CardCommentsBridge;
};

const draftFrom = (card: Card): CardFields => ({
  title: card.title,
  details: card.details,
  priority: card.priority ?? null,
  dueDate: card.dueDate ?? null,
  labels: card.labels ?? [],
});

export const KanbanCard = ({
  card,
  onEdit,
  onDelete,
  cardComments,
}: KanbanCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<CardFields>(() => draftFrom(card));

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = draft.title.trim();
    if (!title) {
      return;
    }
    onEdit(card.id, {
      ...draft,
      title,
      details: draft.details.trim(),
      labels: normalizeLabels(draft.labels),
    });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <form
        ref={setNodeRef}
        style={style}
        onSubmit={handleSubmit}
        className="space-y-3 rounded-2xl border border-[var(--primary-blue)] bg-white px-4 py-4 shadow-[0_12px_24px_rgba(3,33,71,0.08)]"
      >
        <input
          value={draft.title}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, title: event.target.value }))
          }
          aria-label="Card title"
          className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
          required
        />
        <textarea
          value={draft.details}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, details: event.target.value }))
          }
          aria-label="Card details"
          rows={3}
          className="w-full resize-none rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--gray-text)] outline-none focus:border-[var(--primary-blue)]"
        />
        <CardMetaFields
          priority={draft.priority}
          dueDate={draft.dueDate}
          onPriorityChange={(priority) =>
            setDraft((prev) => ({ ...prev, priority }))
          }
          onDueDateChange={(dueDate) => setDraft((prev) => ({ ...prev, dueDate }))}
        />
        <LabelEditor
          labels={draft.labels}
          onChange={(labels) => setDraft((prev) => ({ ...prev, labels }))}
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(draftFrom(card));
              setIsEditing(false);
            }}
            className="rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "rounded-2xl border border-transparent bg-white px-4 py-4 shadow-[0_12px_24px_rgba(3,33,71,0.08)]",
        "transition-all duration-150",
        isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      {...attributes}
      {...listeners}
      data-testid={`card-${card.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-display text-base font-semibold text-[var(--navy-dark)]">
            {card.title}
          </h4>
          <p className="mt-2 text-sm leading-6 text-[var(--gray-text)]">
            {card.details}
          </p>
          <CardMetaBadges priority={card.priority} dueDate={card.dueDate} />
          <LabelChips labels={card.labels ?? []} className="mt-2" />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setDraft(draftFrom(card));
              setIsEditing(true);
            }}
            className="rounded-full border border-transparent p-1.5 text-[var(--gray-text)] transition hover:border-[var(--stroke)] hover:text-[var(--primary-blue)]"
            aria-label={`Edit ${card.title}`}
            title="Edit card"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(card.id)}
            className="rounded-full border border-transparent p-1.5 text-[var(--gray-text)] transition hover:border-[var(--stroke)] hover:text-[var(--secondary-purple)]"
            aria-label={`Delete ${card.title}`}
            title="Delete card"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
      {cardComments && (
        <div
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <CardComments
            comments={cardComments.commentsByCard[card.id] ?? []}
            currentUsername={cardComments.currentUsername}
            onAdd={(body) => cardComments.onAddComment(card.id, body)}
            onDelete={(commentId) => cardComments.onDeleteComment?.(commentId)}
          />
        </div>
      )}
    </article>
  );
};
