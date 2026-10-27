import type { Board, BoardCard, Problem } from "@eisenhower/model";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "../controls/Button";
import { InlineQuestion } from "../controls/InlineQuestion";
import { Notice } from "../controls/Notice";
import { Select } from "../controls/Select";
import { TextField } from "../controls/TextField";
import { TreeDialog } from "../controls/TreeDialog";
import type { MessageKey } from "../strings/en-GB";
import { useTranslate } from "../strings/translate";
import { PALETTE } from "../theme/palette";
import { Swatch } from "./CardItem";
import { type CardDraft, type CardProblem, cardDraft, cardFromDraft } from "./draft";

const CARD_PROBLEM_LABELS = {
  titleBlank: "board.card.problemTitleBlank",
  titleTooLong: "board.card.problemTitleTooLong",
  summaryTooLong: "board.card.problemSummaryTooLong",
  column: "board.card.problemColumn",
  colour: "board.card.problemColour",
} as const satisfies Record<CardProblem, MessageKey>;

/** Why an edit of the board was refused, in words. */
export const BOARD_PROBLEM_LABELS = {
  blank: "board.problem.blank",
  tooLong: "board.problem.tooLong",
  limit: "board.problem.limit",
  missing: "board.problem.missing",
  duplicate: "board.problem.duplicate",
  order: "board.problem.order",
  invalid: "board.problem.invalid",
} as const satisfies Record<Problem, MessageKey>;

/** What the dialog shows: a card on the board, or a new one (its title proposed) not on it until saved. */
export type CardDialogSubject = { kind: "card"; card: BoardCard } | { kind: "new"; card: BoardCard };

/**
 * A card in a modal dialog: its title, summary, column and colour. Changes are kept only on Save, which lists
 * every reason it cannot save, else saves and closes. Cancel or Escape discards them, asking first when
 * something changed. A saved card can be deleted from here, after asking. Read-only, the fields only show the
 * card, and Close (or Escape) closes it. Copied from jerome's PlotBeatDialog.tsx, without the status, target,
 * links and notes (a host shows its own with the card's badge or its own editor).
 */
export function CardDialog({
  board,
  subject,
  readOnly,
  problem,
  onSave,
  onDelete,
  onClose,
}: {
  board: Board;
  subject: CardDialogSubject;
  readOnly: boolean;
  /** Why the board refused the last change, shown in the dialog. */
  problem: Problem | null;
  /** Saves the card; false when the board refused it. */
  onSave: (card: BoardCard) => boolean;
  /** Deletes the card (the board then closes the dialog). */
  onDelete: () => void;
  /** Closes the dialog: the focus goes to this card (null: New card), after a change to the board or not. */
  onClose: (focus: string | null, changed: boolean) => void;
}) {
  const t = useTranslate();
  const id = useId();
  const saved = subject.kind === "card";
  const cardId = subject.card.id;
  const [initial] = useState<CardDraft>(() => cardDraft(subject.card));
  const [draft, setDraft] = useState<CardDraft>(initial);
  // Reasons are shown once Save was tried, and follow the fields from then on.
  const [tried, setTried] = useState(false);
  const [asking, setAsking] = useState<"discard" | "delete" | null>(null);
  const titleInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleInput.current?.focus();
    titleInput.current?.select();
  }, []);

  const result = cardFromDraft(draft, cardId, board);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const heading = saved ? subject.card.title : t("board.newCard");

  function save() {
    if (readOnly) return;
    // An unchanged saved card has nothing to save; a new one is checked and made even when left as it opened.
    if (!dirty && saved) {
      onClose(cardId, false);
      return;
    }
    setTried(true);
    if (!("card" in result)) return;
    if (onSave(result.card)) onClose(cardId, true);
  }

  function cancel() {
    if (dirty && !readOnly) {
      setAsking("discard");
      return;
    }
    onClose(saved ? cardId : null, false);
  }

  /** Closes the question and goes back to the title. */
  function backToTitle() {
    setAsking(null);
    titleInput.current?.focus();
  }

  const edit = (change: Partial<CardDraft>) => {
    setAsking((old) => (old === "discard" ? null : old));
    setDraft((old) => ({ ...old, ...change }));
  };
  const problems = tried && "problems" in result ? result.problems : [];
  const colour = draft.colour === "" ? null : Number(draft.colour);
  const shownColour =
    colour !== null && Number.isInteger(colour) && colour >= 0 && colour < PALETTE.length ? colour : null;

  return (
    <TreeDialog
      label={heading}
      className="eh-board-dialog"
      onCancel={cancel}
      onEscape={() => (asking ? backToTitle() : cancel())}
      onSubmit={save}
    >
      <h3>{heading}</h3>
      <div className="eh-board-dialog-body">
        <div className="eh-board-field">
          <label htmlFor={`${id}-title`}>{t("board.card.title")}</label>
          <TextField
            id={`${id}-title`}
            ref={titleInput}
            value={draft.title}
            readOnly={readOnly}
            onChange={(event) => edit({ title: event.target.value })}
          />
        </div>
        <div className="eh-board-field">
          <label htmlFor={`${id}-summary`}>{t("board.card.summary")}</label>
          <TextField
            id={`${id}-summary`}
            value={draft.summary}
            readOnly={readOnly}
            onChange={(event) => edit({ summary: event.target.value })}
          />
        </div>
        <div className="eh-board-field-row">
          <div className="eh-board-field">
            <label htmlFor={`${id}-column`}>{t("board.card.column")}</label>
            <Select
              id={`${id}-column`}
              value={draft.columnId}
              disabled={readOnly}
              onChange={(event) => edit({ columnId: event.target.value })}
            >
              <option value="">{t("board.noColumn")}</option>
              {draft.columnId !== "" && !board.columns.some((column) => column.id === draft.columnId) && (
                <option value={draft.columnId}>{t("board.card.columnGone")}</option>
              )}
              {board.columns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="eh-board-field">
            <label htmlFor={`${id}-colour`}>{t("board.card.colour")}</label>
            <span className="eh-board-colour-choice">
              <Swatch colour={shownColour} />
              <Select
                id={`${id}-colour`}
                value={draft.colour}
                disabled={readOnly}
                onChange={(event) => edit({ colour: event.target.value })}
              >
                <option value="">{t("board.card.noColour")}</option>
                {PALETTE.map((option, value) => (
                  <option key={option.name} value={String(value)}>
                    {t(option.name)}
                  </option>
                ))}
              </Select>
            </span>
          </div>
        </div>
      </div>
      {problems.map((one) => (
        <Notice tone="problem" key={one}>
          {t(CARD_PROBLEM_LABELS[one])}
        </Notice>
      ))}
      {problem && <Notice tone="problem">{t(BOARD_PROBLEM_LABELS[problem])}</Notice>}
      {asking === "discard" && (
        <InlineQuestion
          label={t("board.card.discardChanges")}
          question={t("board.card.discardChanges")}
          actions={
            <>
              <Button autoFocus onClick={() => onClose(saved ? cardId : null, false)}>
                {t("board.card.discard")}
              </Button>
              <Button onClick={backToTitle}>{t("board.card.keepEditing")}</Button>
            </>
          }
        />
      )}
      {asking === "delete" && (
        <InlineQuestion
          label={t("board.deleteCard")}
          question={t("board.deleteCardWarning")}
          actions={
            <>
              <Button autoFocus variant="danger" onClick={onDelete}>
                {t("board.confirmDeleteCard")}
              </Button>
              <Button onClick={backToTitle}>{t("common.cancel")}</Button>
            </>
          }
        />
      )}
      <div className="eh-dialog-actions">
        {readOnly ? (
          <Button onClick={cancel}>{t("board.card.close")}</Button>
        ) : (
          <>
            {saved && (
              <Button className="eh-board-dialog-delete" variant="danger" onClick={() => setAsking("delete")}>
                {t("board.deleteCard")}
              </Button>
            )}
            <Button type="submit" variant="primary">
              {t("common.save")}
            </Button>
            <Button onClick={cancel}>{t("common.cancel")}</Button>
          </>
        )}
      </div>
    </TreeDialog>
  );
}
