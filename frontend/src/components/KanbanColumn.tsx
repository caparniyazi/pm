import clsx from "clsx";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Card, CardFields, Column } from "@/lib/kanban";
import { KanbanCard, type CardCommentsBridge } from "@/components/KanbanCard";
import { NewCardForm } from "@/components/NewCardForm";

type KanbanColumnProps = {
  column: Column;
  cards: Card[];
  onRename: (columnId: string, title: string) => void;
  onAddCard: (columnId: string, fields: CardFields) => void;
  onEditCard: (cardId: string, fields: CardFields) => void;
  onDeleteCard: (columnId: string, cardId: string) => void;
  cardComments?: CardCommentsBridge;
  columnPosition?: { index: number; count: number };
  onMoveColumn?: (columnId: string, delta: number) => void;
  onRemoveColumn?: (columnId: string) => void;
};

export const KanbanColumn = ({
  column,
  cards,
  onRename,
  onAddCard,
  onEditCard,
  onDeleteCard,
  cardComments,
  columnPosition,
  onMoveColumn,
  onRemoveColumn,
}: KanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const canMove = Boolean(columnPosition && onMoveColumn);
  const isFirst = columnPosition?.index === 0;
  const isLast =
    columnPosition !== undefined &&
    columnPosition.index === columnPosition.count - 1;

  return (
    <section
      ref={setNodeRef}
      className={clsx(
        "flex h-full min-h-[420px] flex-col rounded-3xl border border-[var(--stroke)] bg-[var(--surface-strong)] p-4 shadow-[var(--shadow)] transition",
        isOver && "ring-2 ring-[var(--accent-yellow)]"
      )}
      data-testid={`column-${column.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="w-full">
          <div className="flex items-center gap-3">
            <div className="h-2 w-10 rounded-full bg-[var(--accent-yellow)]" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              {cards.length} cards
            </span>
            {(canMove || onRemoveColumn) && (
              <div className="ml-auto flex items-center gap-0.5">
                {canMove && (
                  <>
                    <button
                      type="button"
                      onClick={() => onMoveColumn?.(column.id, -1)}
                      disabled={isFirst}
                      aria-label={`Move column ${column.title} left`}
                      className="rounded-full p-1 text-[var(--gray-text)] transition hover:text-[var(--primary-blue)] disabled:opacity-30"
                    >
                      &#8592;
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveColumn?.(column.id, 1)}
                      disabled={isLast}
                      aria-label={`Move column ${column.title} right`}
                      className="rounded-full p-1 text-[var(--gray-text)] transition hover:text-[var(--primary-blue)] disabled:opacity-30"
                    >
                      &#8594;
                    </button>
                  </>
                )}
                {onRemoveColumn && (
                  <button
                    type="button"
                    onClick={() => onRemoveColumn(column.id)}
                    aria-label={`Delete column ${column.title}`}
                    className="rounded-full p-1 text-[var(--gray-text)] transition hover:text-[var(--secondary-purple)]"
                  >
                    &#215;
                  </button>
                )}
              </div>
            )}
          </div>
          <input
            value={column.title}
            onChange={(event) => onRename(column.id, event.target.value)}
            className="mt-3 w-full bg-transparent font-display text-lg font-semibold text-[var(--navy-dark)] outline-none"
            aria-label="Column title"
          />
        </div>
      </div>
      <div className="mt-4 flex flex-1 flex-col gap-3">
        <SortableContext items={column.cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              onEdit={onEditCard}
              onDelete={(cardId) => onDeleteCard(column.id, cardId)}
              cardComments={cardComments}
            />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-[var(--stroke)] px-3 py-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            Drop a card here
          </div>
        )}
      </div>
      <NewCardForm onAdd={(fields) => onAddCard(column.id, fields)} />
    </section>
  );
};
