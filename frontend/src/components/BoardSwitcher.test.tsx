import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoardSwitcher } from "@/components/BoardSwitcher";

const BOARDS = [
  { id: "board-1", title: "First", updatedAt: "2024-01-01" },
  { id: "board-2", title: "Second", updatedAt: "2024-01-02" },
];

describe("BoardSwitcher", () => {
  it("selects a board when its tab is clicked", async () => {
    const onSelect = vi.fn();
    render(
      <BoardSwitcher
        boards={BOARDS}
        selectedBoardId="board-1"
        onSelect={onSelect}
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    await userEvent.click(screen.getByText("Second"));

    expect(onSelect).toHaveBeenCalledWith("board-2");
  });

  it("creates a board through the inline form", async () => {
    const onCreate = vi.fn();
    render(
      <BoardSwitcher
        boards={BOARDS}
        selectedBoardId="board-1"
        onSelect={vi.fn()}
        onCreate={onCreate}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "New board" }));
    await userEvent.type(screen.getByLabelText("New board name"), "Third");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(onCreate).toHaveBeenCalledWith("Third");
  });

  it("renames a board through its inline edit control", async () => {
    const onRename = vi.fn();
    render(
      <BoardSwitcher
        boards={BOARDS}
        selectedBoardId="board-1"
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onRename={onRename}
        onDelete={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Rename First" }));
    const input = screen.getByLabelText("Board title");
    await userEvent.clear(input);
    await userEvent.type(input, "Renamed{Enter}");

    expect(onRename).toHaveBeenCalledWith("board-1", "Renamed");
  });

  it("deletes a board when more than one exists", async () => {
    const onDelete = vi.fn();
    render(
      <BoardSwitcher
        boards={BOARDS}
        selectedBoardId="board-1"
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDelete={onDelete}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Delete First" }));

    expect(onDelete).toHaveBeenCalledWith("board-1");
  });

  it("hides delete controls when only one board remains", () => {
    render(
      <BoardSwitcher
        boards={[BOARDS[0]]}
        selectedBoardId="board-1"
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Delete First" })).not.toBeInTheDocument();
  });
});
