import {
  addComment,
  askAI,
  createBoard,
  deleteBoard,
  deleteComment,
  fetchBoard,
  listActivity,
  listBoards,
  listComments,
  login,
  register,
  renameBoard,
  saveBoard,
} from "@/lib/api";
import { storeToken } from "@/lib/auth";
import { initialData } from "@/lib/kanban";

describe("board API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("registers a new user without an existing token", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ token: "tok", user: { id: "u1", username: "alice" } }),
        { status: 201 }
      )
    );

    const response = await register("alice", "password123");

    expect(response.user.username).toBe("alice");
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/register",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ username: "alice", password: "password123" }),
        headers: expect.not.objectContaining({ Authorization: expect.anything() }),
      })
    );
  });

  it("logs in and reports invalid credentials", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Invalid username or password" }), {
        status: 401,
      })
    );

    await expect(login("alice", "wrong")).rejects.toThrow(
      "Invalid username or password"
    );
  });

  it("attaches the stored bearer token to authenticated requests", async () => {
    storeToken("my-token");
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 })
    );

    await listBoards();

    expect(fetch).toHaveBeenCalledWith(
      "/api/boards",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer my-token" }),
      })
    );
  });

  it("creates, renames, and deletes a board", async () => {
    storeToken("my-token");
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: "board-2", title: "New", updatedAt: "now" }),
          { status: 201 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: "board-2", title: "Renamed", updatedAt: "later" }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const created = await createBoard("New");
    expect(created.id).toBe("board-2");

    const renamed = await renameBoard("board-2", "Renamed");
    expect(renamed.title).toBe("Renamed");

    await expect(deleteBoard("board-2")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("loads a specific board", async () => {
    storeToken("my-token");
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(initialData), { status: 200 })
    );

    await fetchBoard("board-1");

    expect(fetch).toHaveBeenCalledWith(
      "/api/boards/board-1",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer my-token" }),
      })
    );
  });

  it("saves the board and reports HTTP failures", async () => {
    storeToken("my-token");
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(initialData), { status: 200 }))
      .mockResolvedValueOnce(new Response("failed", { status: 500 }));

    await saveBoard("board-1", initialData);
    await expect(saveBoard("board-1", initialData)).rejects.toThrow(
      "Request failed (500)"
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends chat questions and conversation history for a specific board", async () => {
    storeToken("my-token");
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          assistant_response: "Done",
          board_update: null,
          board: initialData,
        }),
        { status: 200 }
      )
    );

    await askAI("board-1", "Move the card", [
      { role: "user", content: "Earlier question" },
    ]);

    expect(fetch).toHaveBeenCalledWith(
      "/api/boards/board-1/ai/chat",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          question: "Move the card",
          history: [{ role: "user", content: "Earlier question" }],
        }),
      })
    );
  });

  it("reads comments and activity and posts a new comment", async () => {
    storeToken("my-token");
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "cmt-1",
            cardId: "card-1",
            author: "alice",
            body: "Nice",
            createdAt: "2026-01-01T00:00:00Z",
          }),
          { status: 201 }
        )
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await listComments("board-1");
    await listActivity("board-1");
    const created = await addComment("board-1", "card-1", "Nice");
    await deleteComment("board-1", "cmt-1");

    expect(created.id).toBe("cmt-1");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/boards/board-1/comments");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/boards/board-1/activity");
    expect(fetchMock.mock.calls[2]).toEqual([
      "/api/boards/board-1/cards/card-1/comments",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ body: "Nice" }),
      }),
    ]);
    expect(fetchMock.mock.calls[3]).toEqual([
      "/api/boards/board-1/comments/cmt-1",
      expect.objectContaining({ method: "DELETE" }),
    ]);
  });
});
