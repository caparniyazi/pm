import {
  addColumn,
  canRemoveColumn,
  moveCard,
  moveColumn,
  normalizeLabels,
  removeColumn,
  type BoardData,
  type Column,
} from "@/lib/kanban";

describe("moveCard", () => {
  const baseColumns: Column[] = [
    { id: "col-a", title: "A", cardIds: ["card-1", "card-2"] },
    { id: "col-b", title: "B", cardIds: ["card-3"] },
  ];

  it("reorders cards in the same column", () => {
    const result = moveCard(baseColumns, "card-2", "card-1");
    expect(result[0].cardIds).toEqual(["card-2", "card-1"]);
  });

  it("moves cards to another column", () => {
    const result = moveCard(baseColumns, "card-2", "card-3");
    expect(result[0].cardIds).toEqual(["card-1"]);
    expect(result[1].cardIds).toEqual(["card-2", "card-3"]);
  });

  it("drops cards to the end of a column", () => {
    const result = moveCard(baseColumns, "card-1", "col-b");
    expect(result[0].cardIds).toEqual(["card-2"]);
    expect(result[1].cardIds).toEqual(["card-3", "card-1"]);
  });
});

describe("normalizeLabels", () => {
  it("trims and drops case-insensitive duplicates", () => {
    expect(normalizeLabels(["  Bug ", "bug", "urgent"])).toEqual([
      "Bug",
      "urgent",
    ]);
  });

  it("removes empty entries and caps the count at ten", () => {
    const many = Array.from({ length: 15 }, (_, index) => `label-${index}`);
    expect(normalizeLabels(["", "  ", "keep"])).toEqual(["keep"]);
    expect(normalizeLabels(many)).toHaveLength(10);
  });

  it("truncates a label to the maximum length", () => {
    const [label] = normalizeLabels(["x".repeat(50)]);
    expect(label).toHaveLength(32);
  });
});

describe("column operations", () => {
  const board = (): BoardData => ({
    columns: [
      { id: "a", title: "A", cardIds: ["c1"] },
      { id: "b", title: "B", cardIds: [] },
      { id: "c", title: "C", cardIds: [] },
    ],
    cards: { c1: { id: "c1", title: "One", details: "" } },
  });

  it("appends a trimmed new column and ignores blank titles", () => {
    const columns = addColumn(board().columns, "  Blocked  ");
    expect(columns).toHaveLength(4);
    expect(columns[3].title).toBe("Blocked");
    expect(addColumn(board().columns, "   ")).toHaveLength(3);
  });

  it("only allows removing an empty, non-last column", () => {
    const b = board();
    expect(canRemoveColumn(b, "a")).toBe(false); // has a card
    expect(canRemoveColumn(b, "b")).toBe(true);
    expect(canRemoveColumn({ ...b, columns: [b.columns[1]] }, "b")).toBe(false);

    const removed = removeColumn(b, "b");
    expect(removed.columns.map((column) => column.id)).toEqual(["a", "c"]);
    expect(removeColumn(b, "a")).toBe(b); // refused, same reference
  });

  it("moves a column by a delta and clamps at the edges", () => {
    const columns = board().columns;
    expect(moveColumn(columns, "c", -1).map((c) => c.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
    expect(moveColumn(columns, "a", -1)).toBe(columns); // already first
    expect(moveColumn(columns, "c", 1)).toBe(columns); // already last
  });
});
