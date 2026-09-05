"use client";

import clsx from "clsx";
import { useState, type FormEvent } from "react";
import type { BoardSummary } from "@/lib/api";
import { PencilIcon, PlusIcon, TrashIcon } from "@/components/icons";

type BoardSwitcherProps = {
  boards: BoardSummary[];
  selectedBoardId: string;
  onSelect: (boardId: string) => void;
  onCreate: (title: string) => void | Promise<void>;
  onRename: (boardId: string, title: string) => void | Promise<void>;
  onDelete: (boardId: string) => void | Promise<void>;
};

export const BoardSwitcher = ({
  boards,
  selectedBoardId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: BoardSwitcherProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) {
      return;
    }
    await onCreate(title);
    setNewTitle("");
    setIsCreating(false);
  };

  const submitRename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = renameDraft.trim();
    if (title && renamingId) {
      await onRename(renamingId, title);
    }
    setRenamingId(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {boards.map((board) =>
        renamingId === board.id ? (
          <form key={board.id} onSubmit={submitRename}>
            <input
              value={renameDraft}
              onChange={(event) => setRenameDraft(event.target.value)}
              onBlur={() => setRenamingId(null)}
              aria-label="Board title"
              autoFocus
              className="w-36 rounded-full border border-[var(--primary-blue)] px-3 py-1.5 text-sm font-semibold text-[var(--navy-dark)] outline-none"
            />
          </form>
        ) : (
          <div
            key={board.id}
            className={clsx(
              "group flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold transition",
              board.id === selectedBoardId
                ? "border-[var(--primary-blue)] bg-[var(--primary-blue)]/10 text-[var(--primary-blue)]"
                : "border-[var(--stroke)] text-[var(--navy-dark)] hover:border-[var(--primary-blue)]"
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(board.id)}
              className="max-w-[10rem] truncate"
            >
              {board.title}
            </button>
            <button
              type="button"
              onClick={() => {
                setRenamingId(board.id);
                setRenameDraft(board.title);
              }}
              aria-label={`Rename ${board.title}`}
              title="Rename board"
              className="opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100"
            >
              <PencilIcon className="h-3.5 w-3.5" />
            </button>
            {boards.length > 1 ? (
              <button
                type="button"
                onClick={() => onDelete(board.id)}
                aria-label={`Delete ${board.title}`}
                title="Delete board"
                className="opacity-0 transition hover:text-[var(--secondary-purple)] group-hover:opacity-100 group-focus-within:opacity-100"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        )
      )}
      {isCreating ? (
        <form onSubmit={handleCreate} className="flex items-center gap-1">
          <input
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="Board name"
            aria-label="New board name"
            autoFocus
            className="w-32 rounded-full border border-[var(--primary-blue)] px-3 py-1.5 text-sm outline-none"
          />
          <button
            type="submit"
            className="rounded-full bg-[var(--secondary-purple)] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setIsCreating(false);
              setNewTitle("");
            }}
            className="text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1 rounded-full border border-dashed border-[var(--stroke)] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--primary-blue)] transition hover:border-[var(--primary-blue)]"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          New board
        </button>
      )}
    </div>
  );
};
