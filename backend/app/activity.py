"""Derive an activity feed by diffing two board snapshots.

A full-board ``PUT`` replaces every column and card, so the only way to know
what a user actually changed is to compare the board before and after. This
module is pure: ``diff_board_activity`` takes the old and new ``BoardData``
and returns the entries to append to the log, in a deterministic order
(column renames, then card changes in the new board's reading order, then
deletions).
"""

from dataclasses import dataclass

from backend.app.models import ActivityKind, BoardData


@dataclass(frozen=True)
class ActivityDiffEntry:
    kind: ActivityKind
    summary: str
    card_id: str | None


def _column_id_by_card(board: BoardData) -> dict[str, str]:
    location: dict[str, str] = {}
    for column in board.columns:
        for card_id in column.cardIds:
            location[card_id] = column.id
    return location


def _card_fields_changed(old, new) -> list[str]:
    changed: list[str] = []
    if old.title != new.title:
        changed.append("title")
    if old.details != new.details:
        changed.append("details")
    if old.priority != new.priority:
        changed.append("priority")
    if old.dueDate != new.dueDate:
        changed.append("due date")
    if old.labels != new.labels:
        changed.append("labels")
    return changed


def diff_board_activity(old: BoardData, new: BoardData) -> list[ActivityDiffEntry]:
    entries: list[ActivityDiffEntry] = []

    old_titles = {column.id: column.title for column in old.columns}
    new_titles = {column.id: column.title for column in new.columns}
    for column_id, title in new_titles.items():
        previous = old_titles.get(column_id)
        if previous is not None and previous != title:
            entries.append(
                ActivityDiffEntry(
                    kind="column_renamed",
                    summary=f'Renamed column "{previous}" to "{title}"',
                    card_id=None,
                )
            )

    old_location = _column_id_by_card(old)
    new_location = _column_id_by_card(new)

    for card_id in [cid for column in new.columns for cid in column.cardIds]:
        new_card = new.cards[card_id]
        old_card = old.cards.get(card_id)
        current_column = new_titles[new_location[card_id]]
        if old_card is None:
            entries.append(
                ActivityDiffEntry(
                    kind="card_created",
                    summary=f'Added "{new_card.title}" to {current_column}',
                    card_id=card_id,
                )
            )
            continue

        old_column_id = old_location.get(card_id)
        if old_column_id is not None and old_column_id != new_location[card_id]:
            entries.append(
                ActivityDiffEntry(
                    kind="card_moved",
                    summary=(
                        f'Moved "{new_card.title}" from {old_titles[old_column_id]} '
                        f"to {current_column}"
                    ),
                    card_id=card_id,
                )
            )

        changed = _card_fields_changed(old_card, new_card)
        if changed:
            if old_card.title != new_card.title:
                summary = f'Renamed "{old_card.title}" to "{new_card.title}"'
            else:
                summary = f'Updated {", ".join(changed)} on "{new_card.title}"'
            entries.append(
                ActivityDiffEntry(kind="card_edited", summary=summary, card_id=card_id)
            )

    for card_id, old_card in old.cards.items():
        if card_id not in new.cards:
            old_column_id = old_location.get(card_id)
            column = old_titles.get(old_column_id, "the board") if old_column_id else "the board"
            entries.append(
                ActivityDiffEntry(
                    kind="card_deleted",
                    summary=f'Deleted "{old_card.title}" from {column}',
                    card_id=card_id,
                )
            )

    return entries
