import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardComments } from "@/components/CardComments";
import type { Comment } from "@/lib/api";

const comment = (overrides: Partial<Comment> = {}): Comment => ({
  id: "cmt-1",
  cardId: "card-1",
  author: "alice",
  body: "First note",
  createdAt: "2026-01-02T09:30:00Z",
  ...overrides,
});

describe("CardComments", () => {
  it("hides the thread until the toggle is clicked", async () => {
    render(
      <CardComments
        comments={[comment()]}
        currentUsername="alice"
        onAdd={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.queryByText("First note")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /comments \(1\)/i }));
    expect(screen.getByText("First note")).toBeInTheDocument();
  });

  it("submits a trimmed comment body", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(
      <CardComments
        comments={[]}
        currentUsername="alice"
        onAdd={onAdd}
        onDelete={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /add comment/i }));
    await userEvent.type(screen.getByLabelText("New comment"), "  Looks good  ");
    await userEvent.click(screen.getByRole("button", { name: "Comment" }));

    expect(onAdd).toHaveBeenCalledWith("Looks good");
  });

  it("only offers delete on the current user's own comments", async () => {
    const onDelete = vi.fn();
    render(
      <CardComments
        comments={[
          comment({ id: "mine", author: "alice", body: "Mine" }),
          comment({ id: "theirs", author: "bob", body: "Theirs" }),
        ]}
        currentUsername="alice"
        onAdd={vi.fn()}
        onDelete={onDelete}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /comments \(2\)/i }));

    const mine = screen.getByTestId("comment-mine");
    const theirs = screen.getByTestId("comment-theirs");
    expect(within(mine).getByRole("button", { name: /delete comment/i })).toBeInTheDocument();
    expect(
      within(theirs).queryByRole("button", { name: /delete comment/i })
    ).not.toBeInTheDocument();

    await userEvent.click(within(mine).getByRole("button", { name: /delete comment/i }));
    expect(onDelete).toHaveBeenCalledWith("mine");
  });
});
