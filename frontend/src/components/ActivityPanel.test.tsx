import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivityPanel } from "@/components/ActivityPanel";
import type { ActivityEntry } from "@/lib/api";

const entry = (overrides: Partial<ActivityEntry> = {}): ActivityEntry => ({
  id: "act-1",
  kind: "card_created",
  summary: 'Added "Draft" to Backlog',
  cardId: "card-1",
  createdAt: "2026-02-03T14:05:00Z",
  ...overrides,
});

describe("ActivityPanel", () => {
  it("is collapsed by default and expands on click", async () => {
    render(<ActivityPanel activity={[entry()]} />);

    expect(screen.queryByText('Added "Draft" to Backlog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /activity/i }));
    expect(screen.getByText('Added "Draft" to Backlog')).toBeInTheDocument();
    expect(screen.getByText("3 Feb 2026, 14:05 UTC")).toBeInTheDocument();
  });

  it("shows an empty state when there is no activity", async () => {
    render(<ActivityPanel activity={[]} />);

    await userEvent.click(screen.getByRole("button", { name: /activity/i }));
    expect(screen.getByText("No activity yet.")).toBeInTheDocument();
  });
});
