import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatSidebar } from "@/components/ChatSidebar";
import { askAI } from "@/lib/api";
import { initialData } from "@/lib/kanban";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, askAI: vi.fn() };
});

const mockedAskAI = vi.mocked(askAI);

describe("ChatSidebar", () => {
  beforeEach(() => {
    mockedAskAI.mockReset();
  });

  it("submits a question and renders the assistant response", async () => {
    mockedAskAI.mockResolvedValue({
      assistant_response: "I can help with that.",
      board_update: null,
      board: initialData,
    });
    render(<ChatSidebar onBoardUpdate={vi.fn()} />);

    await userEvent.type(
      screen.getByLabelText("Ask the AI assistant"),
      "What is next?"
    );
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("I can help with that.")).toBeInTheDocument();
    expect(mockedAskAI).toHaveBeenCalledWith("What is next?", []);
  });

  it("shows loading and errors", async () => {
    let rejectRequest: (error: Error) => void = () => undefined;
    mockedAskAI.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectRequest = reject;
        })
    );
    render(<ChatSidebar onBoardUpdate={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Ask the AI assistant"), "Help");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByRole("status")).toHaveTextContent("Thinking...");

    rejectRequest(new Error("failed"));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "AI assistant unavailable: failed"
      )
    );
  });

  it("reconciles the board returned by the assistant", async () => {
    const updatedBoard = {
      ...initialData,
      columns: initialData.columns.map((column, index) =>
        index === 0 ? { ...column, title: "Updated" } : column
      ),
    };
    const onBoardUpdate = vi.fn();
    mockedAskAI.mockResolvedValue({
      assistant_response: "Updated the board.",
      board_update: {
        operations: [{ kind: "rename_column" }],
      },
      board: updatedBoard,
    });
    render(<ChatSidebar onBoardUpdate={onBoardUpdate} />);

    await userEvent.type(
      screen.getByLabelText("Ask the AI assistant"),
      "Rename the column"
    );
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await screen.findByText("Updated the board.");
    expect(onBoardUpdate).toHaveBeenCalledWith(updatedBoard);
  });
});
