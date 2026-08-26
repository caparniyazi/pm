"use client";

import { FormEvent, useEffect, useState } from "react";
import { AUTH_STORAGE_KEY, isValidCredentials } from "@/lib/auth";
import { fetchBoard, saveBoard } from "@/lib/api";
import type { BoardData } from "@/lib/kanban";
import { KanbanBoard } from "@/components/KanbanBoard";
import { ChatSidebar } from "@/components/ChatSidebar";

export const AuthGate = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [board, setBoard] = useState<BoardData | null>(null);
  const [boardError, setBoardError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const isStoredAuthenticated =
      window.localStorage.getItem(AUTH_STORAGE_KEY) === "true";
    queueMicrotask(() => setIsAuthenticated(isStoredAuthenticated));
  }, []);

  useEffect(() => {
    if (isAuthenticated !== true) {
      return;
    }

    let cancelled = false;
    fetchBoard()
      .then((loadedBoard) => {
        if (!cancelled) {
          setBoard(loadedBoard);
          setBoardError("");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBoardError("Unable to load your board.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValidCredentials(username, password)) {
      setError("Invalid username or password.");
      return;
    }

    window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
    setError("");
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setIsAuthenticated(false);
    setBoard(null);
    setBoardError("");
    setUsername("");
    setPassword("");
  };

  if (isAuthenticated === null) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <section className="w-full max-w-md rounded-[32px] border border-[var(--stroke)] bg-white/90 p-8 shadow-[var(--shadow)]">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
            Project workspace
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
            Sign in to Kanban Studio
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--gray-text)]">
            Use your workspace credentials to continue.
          </p>
          <form className="mt-8 space-y-5" onSubmit={handleLogin}>
            <label className="block text-sm font-semibold text-[var(--navy-dark)]">
              Username
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[var(--stroke)] px-4 py-3 outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
                autoComplete="username"
              />
            </label>
            <label className="block text-sm font-semibold text-[var(--navy-dark)]">
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[var(--stroke)] px-4 py-3 outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
                autoComplete="current-password"
              />
            </label>
            {error ? (
              <p className="text-sm font-semibold text-[var(--secondary-purple)]" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              className="w-full rounded-xl bg-[var(--secondary-purple)] px-4 py-3 font-semibold text-white transition hover:opacity-90"
            >
              Sign in
            </button>
          </form>
        </section>
      </main>
    );
  }

  if (!board) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <section className="rounded-[32px] border border-[var(--stroke)] bg-white/90 p-8 text-center shadow-[var(--shadow)]">
          <h1 className="font-display text-2xl font-semibold text-[var(--navy-dark)]">
            {boardError || "Loading your board..."}
          </h1>
          {boardError ? (
            <button
              type="button"
              onClick={() => setIsAuthenticated(false)}
              className="mt-5 rounded-xl bg-[var(--secondary-purple)] px-4 py-3 font-semibold text-white"
            >
              Return to sign in
            </button>
          ) : null}
        </section>
      </main>
    );
  }

  const handleBoardChange = async (nextBoard: BoardData) => {
    try {
      const savedBoard = await saveBoard(nextBoard);
      setBoard(savedBoard);
      setBoardError("");
    } catch {
      setBoardError("Unable to save that board change.");
    }
  };

  return (
    <>
      <div className="absolute right-6 top-6 z-10">
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
      <KanbanBoard initialBoard={board} onBoardChange={handleBoardChange} />
      <ChatSidebar onBoardUpdate={setBoard} />
    </>
  );
};
