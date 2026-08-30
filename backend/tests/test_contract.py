import json
from pathlib import Path

from backend.app.models import BoardData

SCHEMA_PATH = Path(__file__).resolve().parents[2] / "docs" / "database-schema.json"

SAMPLE = {
    "columns": [
        {"id": "col-a", "title": "A", "cardIds": ["card-1"]},
        {"id": "col-b", "title": "B", "cardIds": []},
    ],
    "cards": {"card-1": {"id": "card-1", "title": "First", "details": "Notes"}},
}


def test_board_payload_field_names_are_stable() -> None:
    dumped = BoardData.model_validate(SAMPLE).model_dump()

    assert dumped == SAMPLE
    assert set(dumped) == {"columns", "cards"}
    assert set(dumped["columns"][0]) == {"id", "title", "cardIds"}
    assert set(dumped["cards"]["card-1"]) == {"id", "title", "details"}


def test_documented_schema_example_matches_model() -> None:
    board_payload = json.loads(SCHEMA_PATH.read_text())["board_payload"]

    BoardData.model_validate(board_payload)
