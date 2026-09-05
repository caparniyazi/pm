import json
from pathlib import Path

from backend.app.models import BoardData

SCHEMA_PATH = Path(__file__).resolve().parents[2] / "docs" / "database-schema.json"

SAMPLE = {
    "columns": [
        {"id": "col-a", "title": "A", "cardIds": ["card-1"]},
        {"id": "col-b", "title": "B", "cardIds": []},
    ],
    "cards": {
        "card-1": {
            "id": "card-1",
            "title": "First",
            "details": "Notes",
            "priority": "high",
            "dueDate": "2026-01-31",
            "labels": ["research", "q1"],
        }
    },
}


def test_board_payload_field_names_are_stable() -> None:
    dumped = BoardData.model_validate(SAMPLE).model_dump()

    assert dumped == SAMPLE
    assert set(dumped) == {"columns", "cards"}
    assert set(dumped["columns"][0]) == {"id", "title", "cardIds"}
    assert set(dumped["cards"]["card-1"]) == {
        "id",
        "title",
        "details",
        "priority",
        "dueDate",
        "labels",
    }


def test_card_metadata_defaults_to_null() -> None:
    dumped = BoardData.model_validate(
        {
            "columns": [{"id": "col-a", "title": "A", "cardIds": ["card-1"]}],
            "cards": {"card-1": {"id": "card-1", "title": "First", "details": ""}},
        }
    ).model_dump()

    assert dumped["cards"]["card-1"]["priority"] is None
    assert dumped["cards"]["card-1"]["dueDate"] is None
    assert dumped["cards"]["card-1"]["labels"] == []


def test_card_labels_are_trimmed_and_deduplicated() -> None:
    card = BoardData.model_validate(
        {
            "columns": [{"id": "col-a", "title": "A", "cardIds": ["card-1"]}],
            "cards": {
                "card-1": {
                    "id": "card-1",
                    "title": "First",
                    "details": "",
                    "labels": ["  bug ", "Bug", "urgent"],
                }
            },
        }
    ).cards["card-1"]

    assert card.labels == ["bug", "urgent"]


def test_documented_schema_example_matches_model() -> None:
    board_payload = json.loads(SCHEMA_PATH.read_text())["board_payload"]

    BoardData.model_validate(board_payload)
