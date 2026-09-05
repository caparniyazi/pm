import { moveCard, normalizeLabels, type Column } from "@/lib/kanban";

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
