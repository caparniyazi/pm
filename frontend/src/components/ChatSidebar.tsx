"use client";

import { FormEvent, useState } from "react";
import { askAI, type ChatMessage } from "@/lib/api";
import type { BoardData } from "@/lib/kanban";

type ChatSidebarProps = {
  onBoardUpdate: (board: BoardData) => void;
};

export const ChatSidebar = ({ onBoardUpdate }: ChatSidebarProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(true);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isLoading) {
      return;
    }

    const userMessage: ChatMessage = { role: "user", content: trimmedQuestion };
    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setError("");
    setIsLoading(true);

    try {
      const response = await askAI(trimmedQuestion, messages);
      setMessages((current) => [
        ...current,
        { role: "assistant", content: response.assistant_response },
      ]);
      onBoardUpdate(response.board);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to reach the AI assistant.";
      setError(`AI assistant unavailable: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-30 rounded-full bg-[var(--secondary-purple)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow)]"
      >
        Open AI assistant
      </button>
    );
  }

  return (
    <aside
      aria-label="AI assistant"
      className="fixed bottom-4 right-4 z-30 flex max-h-[calc(100vh-2rem)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[28px] border border-[var(--stroke)] bg-white/95 shadow-[var(--shadow)] backdrop-blur lg:bottom-auto lg:right-6 lg:top-24"
    >
      <header className="flex items-center justify-between border-b border-[var(--stroke)] px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
            Workspace AI
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-[var(--navy-dark)]">
            Ask about your board
          </h2>
        </div>
        <button
          type="button"
          aria-label="Close AI assistant"
          onClick={() => setIsOpen(false)}
          className="rounded-full px-3 py-1 text-lg text-[var(--gray-text)] hover:bg-[var(--surface)]"
        >
          ×
        </button>
      </header>

      <div className="min-h-24 flex-1 space-y-3 overflow-y-auto px-5 py-4" aria-live="polite">
        {messages.length === 0 ? (
          <p className="text-sm leading-6 text-[var(--gray-text)]">
            Ask me to organize, update, or explain anything on this board.
          </p>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                message.role === "user"
                  ? "ml-6 bg-[var(--primary-blue)] text-white"
                  : "mr-6 bg-[var(--surface)] text-[var(--navy-dark)]"
              }`}
            >
              {message.content}
            </div>
          ))
        )}
        {isLoading ? (
          <p className="text-sm font-semibold text-[var(--gray-text)]" role="status">
            Thinking...
          </p>
        ) : null}
        {error ? (
          <p className="text-sm font-semibold text-[var(--secondary-purple)]" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <form className="border-t border-[var(--stroke)] p-4" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="ai-question">
          Ask the AI assistant
        </label>
        <textarea
          id="ai-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask a question or request a board change..."
          rows={3}
          className="w-full resize-none rounded-2xl border border-[var(--stroke)] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !question.trim()}
          className="mt-3 w-full rounded-xl bg-[var(--secondary-purple)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </aside>
  );
};
