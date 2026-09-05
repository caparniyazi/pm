import { initialData, type BoardData } from "@/lib/kanban";

// Mirrors backend/tests/test_contract.py. The BoardData payload is defined
// independently on each side, so keep the field names identical.
const CARD_FIELDS = ["details", "dueDate", "id", "priority", "title"];

const sample: BoardData = {
  columns: [
    { id: "col-a", title: "A", cardIds: ["card-1"] },
    { id: "col-b", title: "B", cardIds: [] },
  ],
  cards: {
    "card-1": {
      id: "card-1",
      title: "First",
      details: "Notes",
      priority: "high",
      dueDate: "2026-01-31",
    },
  },
};

describe("BoardData contract", () => {
  it("uses the field names the backend serializes", () => {
    expect(Object.keys(sample).sort()).toEqual(["cards", "columns"]);
    expect(Object.keys(sample.columns[0]).sort()).toEqual([
      "cardIds",
      "id",
      "title",
    ]);
    expect(Object.keys(sample.cards["card-1"]).sort()).toEqual(CARD_FIELDS);
  });

  it("keeps the seed data within the shared card shape", () => {
    for (const column of initialData.columns) {
      expect(Object.keys(column).sort()).toEqual(["cardIds", "id", "title"]);
    }
    for (const card of Object.values(initialData.cards)) {
      // priority and dueDate are optional locally; any present key must be known.
      for (const key of Object.keys(card)) {
        expect(CARD_FIELDS).toContain(key);
      }
    }
  });
});
