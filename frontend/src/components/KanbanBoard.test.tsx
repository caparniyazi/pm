import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

describe("KanbanBoard", () => {
  it("renders five columns", () => {
    render(<KanbanBoard />);
    expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("renames a column", async () => {
    render(<KanbanBoard />);
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
  });

  it("adds and removes a card", async () => {
    render(<KanbanBoard />);
    const column = getFirstColumn();
    const addButton = within(column).getByRole("button", {
      name: /add a card/i,
    });
    await userEvent.click(addButton);

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();

    const deleteButton = within(column).getByRole("button", {
      name: /delete new card/i,
    });
    await userEvent.click(deleteButton);

    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
  });

  it("edits a card in place", async () => {
    render(<KanbanBoard />);
    const column = getFirstColumn();

    await userEvent.click(
      within(column).getByRole("button", { name: /edit align roadmap themes/i })
    );

    const titleInput = within(column).getByLabelText("Card title");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Align themes");
    await userEvent.click(within(column).getByRole("button", { name: /save/i }));

    expect(within(column).getByText("Align themes")).toBeInTheDocument();
    expect(
      within(column).queryByText("Align roadmap themes")
    ).not.toBeInTheDocument();
  });

  it("adds a card with a priority and due date", async () => {
    render(<KanbanBoard />);
    const column = getFirstColumn();

    await userEvent.click(
      within(column).getByRole("button", { name: /add a card/i })
    );
    await userEvent.type(
      within(column).getByPlaceholderText(/card title/i),
      "Prioritised card"
    );
    await userEvent.selectOptions(
      within(column).getByLabelText("Card priority"),
      "high"
    );
    fireEvent.change(within(column).getByLabelText("Card due date"), {
      target: { value: "2026-12-31" },
    });
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    const card = within(column).getByText("Prioritised card").closest("article");
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText("high")).toBeInTheDocument();
    expect(
      within(card as HTMLElement).getByText("Due 31 Dec 2026")
    ).toBeInTheDocument();
  });

  it("changes the priority of an existing card", async () => {
    render(<KanbanBoard />);
    const column = getFirstColumn();

    await userEvent.click(
      within(column).getByRole("button", { name: /edit gather customer signals/i })
    );
    await userEvent.selectOptions(
      within(column).getByLabelText("Card priority"),
      "low"
    );
    await userEvent.click(within(column).getByRole("button", { name: /save/i }));

    const card = within(column)
      .getByText("Gather customer signals")
      .closest("article");
    expect(within(card as HTMLElement).getByText("low")).toBeInTheDocument();
    expect(
      within(card as HTMLElement).queryByText("medium")
    ).not.toBeInTheDocument();
  });

  it("adds a label to a card through the edit form", async () => {
    render(<KanbanBoard />);
    const column = getFirstColumn();

    await userEvent.click(
      within(column).getByRole("button", { name: /edit gather customer signals/i })
    );
    const labelInput = within(column).getByLabelText("Add label");
    await userEvent.type(labelInput, "backend{Enter}");
    await userEvent.click(within(column).getByRole("button", { name: /save/i }));

    const card = within(column)
      .getByText("Gather customer signals")
      .closest("article") as HTMLElement;
    expect(within(card).getByText("backend")).toBeInTheDocument();
  });

  it("filters the board to cards carrying a selected label", async () => {
    render(<KanbanBoard />);
    const filter = screen.getByTestId("label-filter");

    await userEvent.click(within(filter).getByRole("button", { name: "research" }));

    // card-2 carries "research"; card-1 and card-3 do not.
    expect(screen.getByText("Gather customer signals")).toBeInTheDocument();
    expect(screen.queryByText("Align roadmap themes")).not.toBeInTheDocument();
    expect(screen.queryByText("Prototype analytics view")).not.toBeInTheDocument();

    await userEvent.click(within(filter).getByRole("button", { name: /clear/i }));
    expect(screen.getByText("Align roadmap themes")).toBeInTheDocument();
  });

  it("shows an activity panel and posts comments when the handlers are provided", async () => {
    const onAddComment = vi.fn().mockResolvedValue(undefined);
    render(
      <KanbanBoard
        onAddComment={onAddComment}
        onDeleteComment={vi.fn()}
        currentUsername="alice"
        comments={[
          {
            id: "cmt-1",
            cardId: "card-1",
            author: "alice",
            body: "Existing note",
            createdAt: "2026-01-01T00:00:00Z",
          },
        ]}
        activity={[
          {
            id: "act-1",
            kind: "card_created",
            summary: 'Added "Align roadmap themes" to Backlog',
            cardId: "card-1",
            createdAt: "2026-01-01T00:00:00Z",
          },
        ]}
      />
    );

    expect(screen.getByTestId("activity-panel")).toBeInTheDocument();

    const card = screen.getByTestId("card-card-1");
    await userEvent.click(within(card).getByRole("button", { name: /comments \(1\)/i }));
    expect(within(card).getByText("Existing note")).toBeInTheDocument();

    await userEvent.type(within(card).getByLabelText("New comment"), "Another");
    await userEvent.click(within(card).getByRole("button", { name: "Comment" }));
    expect(onAddComment).toHaveBeenCalledWith("card-1", "Another");
  });
});
