import { askAI, fetchBoard, MVP_USER_ID, saveBoard } from "@/lib/api";
import { initialData } from "@/lib/kanban";

describe("board API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the signed-in user's board", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(initialData), { status: 200 })
    );

    await fetchBoard();

    expect(fetch).toHaveBeenCalledWith(
      "/api/board",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-User-Id": MVP_USER_ID }),
      })
    );
  });

  it("saves the board and reports HTTP failures", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(initialData), { status: 200 }))
      .mockResolvedValueOnce(new Response("failed", { status: 500 }));

    await saveBoard(initialData);
    await expect(saveBoard(initialData)).rejects.toThrow("Request failed (500)");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces backend error details", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "OpenRouter returned HTTP 402" }), {
        status: 502,
      })
    );

    await expect(fetchBoard()).rejects.toThrow("OpenRouter returned HTTP 402");
  });

  it("sends chat questions and conversation history", async () => {
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

    await askAI("Move the card", [{ role: "user", content: "Earlier question" }]);

    expect(fetch).toHaveBeenCalledWith(
      "/api/ai/chat",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          question: "Move the card",
          history: [{ role: "user", content: "Earlier question" }],
        }),
      })
    );
  });
});
