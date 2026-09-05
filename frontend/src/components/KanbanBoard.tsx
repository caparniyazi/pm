"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { ReactNode } from "react";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { createId, initialData, moveCard, type BoardData } from "@/lib/kanban";

type KanbanBoardProps = {
  initialBoard?: BoardData;
  onBoardChange?: (board: BoardData) => void | Promise<void>;
  title?: string;
  headerActions?: ReactNode;
};

const RENAME_DEBOUNCE_MS = 400;

export const KanbanBoard = ({
  initialBoard = initialData,
  onBoardChange,
  title = "Kanban Studio",
  headerActions,
}: KanbanBoardProps) => {
  const [board, setBoard] = useState<BoardData>(() => initialBoard);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const renameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reconcile with the controlled source of truth (save echo, AI updates).
  useEffect(() => {
    setBoard(initialBoard);
  }, [initialBoard]);

  useEffect(
    () => () => {
      if (renameTimer.current) {
        clearTimeout(renameTimer.current);
      }
    },
    []
  );

  const persist = (nextBoard: BoardData) => {
    if (!onBoardChange) {
      return;
    }
    Promise.resolve(onBoardChange(nextBoard)).catch(() => {
      // Save failed: drop the optimistic change back to the confirmed board.
      setBoard(initialBoard);
    });
  };

  // Discrete actions (drag, add, delete, edit): apply now, persist now.
  const commit = (nextBoard: BoardData) => {
    setBoard(nextBoard);
    persist(nextBoard);
  };

  // Column rename fires per keystroke: apply now, persist after a pause.
  const commitRename = (nextBoard: BoardData) => {
    setBoard(nextBoard);
    if (!onBoardChange) {
      return;
    }
    if (renameTimer.current) {
      clearTimeout(renameTimer.current);
    }
    renameTimer.current = setTimeout(() => persist(nextBoard), RENAME_DEBOUNCE_MS);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const cardsById = useMemo(() => board.cards, [board.cards]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!over || active.id === over.id) {
      return;
    }

    commit({
      ...board,
      columns: moveCard(board.columns, active.id as string, over.id as string),
    });
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    commitRename({
      ...board,
      columns: board.columns.map((column) =>
        column.id === columnId ? { ...column, title } : column
      ),
    });
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const id = createId("card");
    commit({
      ...board,
      cards: {
        ...board.cards,
        [id]: { id, title, details },
      },
      columns: board.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: [...column.cardIds, id] }
          : column
      ),
    });
  };

  const handleEditCard = (cardId: string, title: string, details: string) => {
    if (!board.cards[cardId]) {
      return;
    }
    commit({
      ...board,
      cards: {
        ...board.cards,
        [cardId]: { ...board.cards[cardId], title, details },
      },
    });
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    commit({
      ...board,
      cards: Object.fromEntries(
        Object.entries(board.cards).filter(([id]) => id !== cardId)
      ),
      columns: board.columns.map((column) =>
        column.id === columnId
          ? {
              ...column,
              cardIds: column.cardIds.filter((id) => id !== cardId),
            }
          : column
      ),
    });
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative flex min-h-screen w-full flex-col gap-8 px-6 pb-16 pt-12 2xl:px-10">
        <header className="flex flex-wrap items-start justify-between gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
              Single Board Kanban
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
              {title}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
              Keep momentum visible. Rename columns, drag cards between stages,
              and capture quick notes without getting buried in settings.
            </p>
          </div>
          {headerActions ?? (
            <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                Focus
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                One board. Five columns. Zero clutter.
              </p>
            </div>
          )}
        </header>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <section className="flex flex-1 items-stretch gap-4 overflow-x-auto pb-2">
            {board.columns.map((column) => (
              <div
                key={column.id}
                className="w-[300px] shrink-0 md:w-[320px] lg:w-0 lg:min-w-[210px] lg:flex-1 lg:shrink"
              >
                <KanbanColumn
                  column={column}
                  cards={column.cardIds.map((cardId) => board.cards[cardId])}
                  onRename={handleRenameColumn}
                  onAddCard={handleAddCard}
                  onEditCard={handleEditCard}
                  onDeleteCard={handleDeleteCard}
                />
              </div>
            ))}
          </section>
          <DragOverlay>
            {activeCard ? (
              <div className="w-[260px]">
                <KanbanCardPreview card={activeCard} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>
    </div>
  );
};
