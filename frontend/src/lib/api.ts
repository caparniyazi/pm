import type { BoardData } from "@/lib/kanban";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
export const MVP_USER_ID = "user-1";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AIChatResponse = {
  assistant_response: string;
  board_update: {
    operations: Array<Record<string, unknown>>;
  } | null;
  board: BoardData;
};

const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": MVP_USER_ID,
      ...options?.headers,
    },
  });
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const errorBody = (await response.json()) as { detail?: string };
      if (errorBody.detail) {
        detail = errorBody.detail;
      }
    } catch {
      // Keep the HTTP status when the server does not return JSON.
    }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
};

export const fetchBoard = () => request<BoardData>("/api/board");

export const saveBoard = (board: BoardData) =>
  request<BoardData>("/api/board", {
    method: "PUT",
    body: JSON.stringify(board),
  });

export const askAI = (question: string, history: ChatMessage[]) =>
  request<AIChatResponse>("/api/ai/chat", {
    method: "POST",
    body: JSON.stringify({ question, history }),
  });
