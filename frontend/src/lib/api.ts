import type { BoardData } from "@/lib/kanban";
import { getStoredToken } from "@/lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export type User = {
  id: string;
  username: string;
};

export type AuthResponse = {
  token: string;
  user: User;
};

export type BoardSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

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

export type Comment = {
  id: string;
  cardId: string;
  author: string;
  body: string;
  createdAt: string;
};

export type ActivityKind =
  | "card_created"
  | "card_edited"
  | "card_moved"
  | "card_deleted"
  | "column_renamed"
  | "comment_added"
  | "comment_deleted";

export type ActivityEntry = {
  id: string;
  kind: ActivityKind;
  summary: string;
  cardId: string | null;
  createdAt: string;
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const token = getStoredToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    throw new ApiError(response.status, detail);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
};

export const register = (username: string, password: string) =>
  request<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

export const login = (username: string, password: string) =>
  request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

export const logout = () => request<void>("/api/auth/logout", { method: "POST" });

export const fetchCurrentUser = () => request<User>("/api/auth/me");

export const listBoards = () => request<BoardSummary[]>("/api/boards");

export const createBoard = (title: string) =>
  request<BoardSummary>("/api/boards", {
    method: "POST",
    body: JSON.stringify({ title }),
  });

export const renameBoard = (boardId: string, title: string) =>
  request<BoardSummary>(`/api/boards/${boardId}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });

export const deleteBoard = (boardId: string) =>
  request<void>(`/api/boards/${boardId}`, { method: "DELETE" });

export const fetchBoard = (boardId: string) =>
  request<BoardData>(`/api/boards/${boardId}`);

export const saveBoard = (boardId: string, board: BoardData) =>
  request<BoardData>(`/api/boards/${boardId}`, {
    method: "PUT",
    body: JSON.stringify(board),
  });

export const askAI = (boardId: string, question: string, history: ChatMessage[]) =>
  request<AIChatResponse>(`/api/boards/${boardId}/ai/chat`, {
    method: "POST",
    body: JSON.stringify({ question, history }),
  });

export const listComments = (boardId: string) =>
  request<Comment[]>(`/api/boards/${boardId}/comments`);

export const addComment = (boardId: string, cardId: string, body: string) =>
  request<Comment>(`/api/boards/${boardId}/cards/${cardId}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });

export const deleteComment = (boardId: string, commentId: string) =>
  request<void>(`/api/boards/${boardId}/comments/${commentId}`, {
    method: "DELETE",
  });

export const listActivity = (boardId: string) =>
  request<ActivityEntry[]>(`/api/boards/${boardId}/activity`);
