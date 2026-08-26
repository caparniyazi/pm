import type { BoardData } from "@/lib/kanban";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
export const MVP_USER_ID = "user-1";

const request = async (path: string, options?: RequestInit): Promise<BoardData> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": MVP_USER_ID,
      ...options?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json();
};

export const fetchBoard = () => request("/api/board");

export const saveBoard = (board: BoardData) =>
  request("/api/board", {
    method: "PUT",
    body: JSON.stringify(board),
  });
