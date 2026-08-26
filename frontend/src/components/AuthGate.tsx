"use client";

import { FormEvent, useEffect, useState } from "react";
import { AUTH_STORAGE_KEY, isValidCredentials } from "@/lib/auth";
import { KanbanBoard } from "@/components/KanbanBoard";

export const AuthGate = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const isStoredAuthenticated =
      window.localStorage.getItem(AUTH_STORAGE_KEY) === "true";
    const timer = window.setTimeout(
      () => setIsAuthenticated(isStoredAuthenticated),
      0
    );
    return () => window.clearTimeout(timer);
  }, []);

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
      <KanbanBoard />
    </>
  );
};
