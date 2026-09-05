"use client";

import { useEffect, useState } from "react";
import {
  ApiError,
  addComment as addCommentRequest,
  createBoard,
  deleteBoard,
  deleteComment as deleteCommentRequest,
  fetchBoard,
  fetchCurrentUser,
  listActivity,
  listBoards,
  listComments,
  logout as logoutRequest,
  renameBoard,
  saveBoard,
  type ActivityEntry,
  type BoardSummary,
  type Comment,
  type User,
} from "@/lib/api";
import { clearToken, getStoredToken, storeToken } from "@/lib/auth";
import type { BoardData } from "@/lib/kanban";
import { AuthForm } from "@/components/AuthForm";
import { BoardSwitcher } from "@/components/BoardSwitcher";
import { KanbanBoard } from "@/components/KanbanBoard";
import { ChatSidebar } from "@/components/ChatSidebar";

export const AuthGate = () => {
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [sessionRestoreError, setSessionRestoreError] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [boards, setBoards] = useState<BoardSummary[] | null>(null);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [board, setBoard] = useState<BoardData | null>(null);
  const [boardError, setBoardError] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [feedVersion, setFeedVersion] = useState(0);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      queueMicrotask(() => setIsRestoringSession(false));
      return;
    }

    let cancelled = false;
    fetchCurrentUser()
      .then((currentUser) => {
        if (!cancelled) {
          setUser(currentUser);
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        // Only a definitive "invalid session" response should sign the user
        // out; a transient network or server error should leave the token in
        // place so a retry (e.g. reloading) can still succeed.
        if (error instanceof ApiError && error.status === 401) {
          clearToken();
        } else {
          setSessionRestoreError("Unable to reach the server. Try reloading the page.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsRestoringSession(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;
    listBoards()
      .then((loadedBoards) => {
        if (cancelled) {
          return;
        }
        setBoards(loadedBoards);
        setSelectedBoardId((current) => current ?? loadedBoards[0]?.id ?? null);
        setBoardError("");
      })
      .catch(() => {
        if (!cancelled) {
          setBoardError("Unable to load your boards.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!selectedBoardId) {
      return;
    }

    let cancelled = false;
    fetchBoard(selectedBoardId)
      .then((loadedBoard) => {
        if (!cancelled) {
          setBoard(loadedBoard);
          setBoardError("");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBoardError("Unable to load this board.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedBoardId]);

  useEffect(() => {
    if (!selectedBoardId) {
      return;
    }

    let cancelled = false;
    Promise.all([listComments(selectedBoardId), listActivity(selectedBoardId)])
      .then(([loadedComments, loadedActivity]) => {
        if (!cancelled) {
          setComments(loadedComments);
          setActivity(loadedActivity);
        }
      })
      .catch(() => {
        // The board itself still loads; a stale feed is not worth an error banner.
      });

    return () => {
      cancelled = true;
    };
  }, [selectedBoardId, feedVersion]);

  const refreshFeeds = () => setFeedVersion((version) => version + 1);

  const handleAuthenticated = (token: string, authenticatedUser: User) => {
    storeToken(token);
    setUser(authenticatedUser);
  };

  const handleLogout = () => {
    logoutRequest().catch(() => undefined);
    clearToken();
    setUser(null);
    setBoards(null);
    setSelectedBoardId(null);
    setBoard(null);
    setBoardError("");
  };

  const handleBoardChange = async (nextBoard: BoardData) => {
    if (!selectedBoardId) {
      return;
    }
    try {
      const savedBoard = await saveBoard(selectedBoardId, nextBoard);
      setBoard(savedBoard);
      setBoardError("");
      refreshFeeds(); // a board save may have generated activity entries
    } catch (error) {
      setBoardError("Unable to save that board change.");
      throw error; // let KanbanBoard roll back its optimistic state
    }
  };

  const handleAddComment = async (cardId: string, body: string) => {
    if (!selectedBoardId) {
      return;
    }
    const created = await addCommentRequest(selectedBoardId, cardId, body);
    setComments((current) => [...current, created]);
    refreshFeeds();
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedBoardId) {
      return;
    }
    await deleteCommentRequest(selectedBoardId, commentId);
    setComments((current) => current.filter((comment) => comment.id !== commentId));
    refreshFeeds();
  };

  const handleCreateBoard = async (title: string) => {
    try {
      const summary = await createBoard(title);
      setBoards((current) => [summary, ...(current ?? [])]);
      setSelectedBoardId(summary.id);
      setBoardError("");
    } catch {
      setBoardError("Unable to create a new board.");
    }
  };

  const handleRenameBoard = async (boardId: string, title: string) => {
    try {
      const summary = await renameBoard(boardId, title);
      setBoards((current) =>
        (current ?? []).map((item) => (item.id === boardId ? summary : item))
      );
      setBoardError("");
    } catch {
      setBoardError("Unable to rename that board.");
    }
  };

  const handleDeleteBoard = async (boardId: string) => {
    try {
      await deleteBoard(boardId);
      setBoards((current) => {
        const remaining = (current ?? []).filter((item) => item.id !== boardId);
        if (selectedBoardId === boardId) {
          setSelectedBoardId(remaining[0]?.id ?? null);
        }
        return remaining;
      });
      setBoardError("");
    } catch {
      setBoardError("Unable to delete that board.");
    }
  };

  if (isRestoringSession) {
    return null;
  }

  if (!user) {
    return (
      <AuthForm onAuthenticated={handleAuthenticated} notice={sessionRestoreError} />
    );
  }

  if (!boards || !board || !selectedBoardId) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <section className="rounded-[32px] border border-[var(--stroke)] bg-white/90 p-8 text-center shadow-[var(--shadow)]">
          <h1 className="font-display text-2xl font-semibold text-[var(--navy-dark)]">
            {boardError || "Loading your boards..."}
          </h1>
        </section>
      </main>
    );
  }

  const currentBoardTitle =
    boards.find((item) => item.id === selectedBoardId)?.title ?? "Kanban Studio";

  return (
    <div className="flex min-h-screen w-full">
      <div className="absolute right-6 top-6 z-10 flex items-center gap-3">
        <span className="hidden text-sm font-semibold text-[var(--navy-dark)] sm:inline">
          {user.username}
        </span>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-full border border-[var(--stroke)] bg-white/90 px-4 py-2 text-sm font-semibold text-[var(--navy-dark)] shadow-sm transition hover:border-[var(--primary-blue)]"
        >
          Log out
        </button>
      </div>
      {boardError ? (
        <div className="fixed bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-xl bg-[var(--secondary-purple)] px-4 py-3 text-sm font-semibold text-white">
          {boardError}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <KanbanBoard
          key={selectedBoardId}
          title={currentBoardTitle}
          initialBoard={board}
          onBoardChange={handleBoardChange}
          comments={comments}
          activity={activity}
          currentUsername={user.username}
          onAddComment={handleAddComment}
          onDeleteComment={handleDeleteComment}
          headerActions={
            <BoardSwitcher
              boards={boards}
              selectedBoardId={selectedBoardId}
              onSelect={setSelectedBoardId}
              onCreate={handleCreateBoard}
              onRename={handleRenameBoard}
              onDelete={handleDeleteBoard}
            />
          }
        />
      </div>
      <ChatSidebar
        key={selectedBoardId}
        boardId={selectedBoardId}
        onBoardUpdate={(updatedBoard) => {
          setBoard(updatedBoard);
          refreshFeeds();
        }}
      />
    </div>
  );
};
