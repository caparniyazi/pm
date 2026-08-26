import { fetchBoard, MVP_USER_ID, saveBoard } from "@/lib/api";
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
});
