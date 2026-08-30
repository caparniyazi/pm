import { initialData, type BoardData } from "@/lib/kanban";

// Mirrors backend/tests/test_contract.py. The BoardData payload is defined
// independently on each side, so keep the field names identical.
const sample: BoardData = {
  columns: [
    { id: "col-a", title: "A", cardIds: ["card-1"] },
    { id: "col-b", title: "B", cardIds: [] },
  ],
  cards: { "card-1": { id: "card-1", title: "First", details: "Notes" } },
};

describe("BoardData contract", () => {
  it("uses the field names the backend serializes", () => {
    expect(Object.keys(sample).sort()).toEqual(["cards", "columns"]);
    expect(Object.keys(sample.columns[0]).sort()).toEqual([
      "cardIds",
      "id",
      "title",
    ]);
    expect(Object.keys(sample.cards["card-1"]).sort()).toEqual([
      "details",
      "id",
      "title",
    ]);
  });

  it("keeps the seed data in the same shape", () => {
    for (const column of initialData.columns) {
      expect(Object.keys(column).sort()).toEqual(["cardIds", "id", "title"]);
    }
    for (const card of Object.values(initialData.cards)) {
      expect(Object.keys(card).sort()).toEqual(["details", "id", "title"]);
    }
  });
});
