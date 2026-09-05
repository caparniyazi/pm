"use client";

import { useState, type FormEvent } from "react";
import { login, register, type User } from "@/lib/api";

type AuthFormProps = {
  onAuthenticated: (token: string, user: User) => void;
  notice?: string;
};

export const AuthForm = ({ onAuthenticated, notice }: AuthFormProps) => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegister = mode === "register";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const response = isRegister
        ? await register(username, password)
        : await login(username, password);
      onAuthenticated(response.token, response.user);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Something went wrong."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-[32px] border border-[var(--stroke)] bg-white/90 p-8 shadow-[var(--shadow)]">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
          Project workspace
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
          {isRegister ? "Create your account" : "Sign in to Kanban Studio"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--gray-text)]">
          {isRegister
            ? "Pick a username and password to get your own boards."
            : "Use your workspace credentials to continue."}
        </p>
        {notice ? (
          <p className="mt-4 text-sm font-semibold text-[var(--secondary-purple)]" role="alert">
            {notice}
          </p>
        ) : null}
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-semibold text-[var(--navy-dark)]">
            Username
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[var(--stroke)] px-4 py-3 outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
              autoComplete="username"
              required
            />
          </label>
          <label className="block text-sm font-semibold text-[var(--navy-dark)]">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[var(--stroke)] px-4 py-3 outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
              autoComplete={isRegister ? "new-password" : "current-password"}
              minLength={isRegister ? 8 : undefined}
              required
            />
          </label>
          {error ? (
            <p className="text-sm font-semibold text-[var(--secondary-purple)]" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-[var(--secondary-purple)] px-4 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRegister ? "Create account" : "Sign in"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => {
            setMode(isRegister ? "login" : "register");
            setError("");
          }}
          className="mt-6 w-full text-center text-sm font-semibold text-[var(--primary-blue)] hover:underline"
        >
          {isRegister ? "Already have an account? Sign in" : "Need an account? Create one"}
        </button>
      </section>
    </main>
  );
};
