import type { BoardCard, Colour } from "@eisenhower/model";
import type { DragEvent, KeyboardEvent, MouseEvent, ReactNode } from "react";

import { Button } from "../controls/Button";
import { IconButton } from "../controls/IconButton";
import { InlineRename } from "../controls/InlineRename";
import { useTranslate } from "../strings/translate";
import { colourVar, PALETTE } from "../theme/palette";
import { MoreIcon } from "./icons";

/** What dragging a card or a column's heading does, from the board. */
export type DragHandlers = {
  draggable: boolean;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
};

/** A colour as a small square; its name is always written beside it, never the colour alone. */
export function Swatch({ colour }: { colour: Colour }) {
  return (
    <span
      className="eh-board-swatch"
      aria-hidden="true"
      data-none={colour === null ? "true" : undefined}
      style={colour === null ? undefined : { background: colourVar(colour) }}
    />
  );
}

/** A card's colour, named, or nothing when it has none. */
function CardColour({ colour }: { colour: Colour }) {
  const t = useTranslate();
  const named = colour === null ? undefined : PALETTE[colour];
  return (
    <span className="eh-board-colour">
      {named && (
        <>
          <Swatch colour={colour} />
          {t(named.name)}
        </>
      )}
    </span>
  );
}

export type CardItemProps = {
  card: BoardCard;
  /** Whether the card is the one chosen (the one last opened, or the host's `selectedId`). */
  selected: boolean;
  /** Whether a dragged card would be dropped just before this one. */
  drop: boolean;
  /** The host's badge, shown with the card's details. */
  badge: ReactNode;
  /** The host's own content for the card's details (instead of its summary, colour and badge). */
  content: ReactNode;
  /** Whether the title is being renamed in place (F2). */
  renaming: boolean;
  onRename: (title: string) => void;
  onRenameCancel: () => void;
  onOpen: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onMenu: (event: MouseEvent<HTMLElement>) => void;
  onMore: (button: HTMLButtonElement) => void;
  drag: DragHandlers;
  /** Shown at the foot of the card or under the row, such as the question before the card is deleted. */
  children?: ReactNode;
};

/** The card's title: the button that opens it and takes the board's keys, or a field while it is renamed. */
function Title({ card, selected, renaming, onRename, onRenameCancel, onOpen, onKeyDown }: CardItemProps) {
  const t = useTranslate();
  if (renaming) {
    return (
      <InlineRename
        className="eh-board-rename"
        title={card.title}
        label={t("board.renameCard", { name: card.title })}
        onRename={onRename}
        onCancel={onRenameCancel}
      />
    );
  }
  return (
    <Button
      variant="quiet"
      className="eh-board-card-title"
      aria-current={selected ? "true" : undefined}
      onClick={onOpen}
      onKeyDown={onKeyDown}
    >
      {card.title}
    </Button>
  );
}

function More({ card, onMore }: CardItemProps) {
  const t = useTranslate();
  return (
    <IconButton
      className="eh-board-more"
      label={t("board.moreActionsNamed", { name: card.title })}
      title={t("board.moreActions")}
      aria-haspopup="menu"
      icon={<MoreIcon />}
      onClick={(event) => onMore(event.currentTarget)}
    />
  );
}

/** A double-click on the card itself (not on one of its controls or its question) opens it. */
function openOnDoubleClick(onOpen: () => void) {
  return (event: MouseEvent<HTMLElement>) => {
    if (event.target instanceof Element && event.target.closest("button, input, [role='alertdialog']")) return;
    onOpen();
  };
}

/**
 * A card on the board: a stripe of its colour (whose name is written below, never the colour alone), its
 * title, summary, colour's name and the host's badge, or the host's own content. Choosing the title opens the
 * card; the card is dragged to move it, and its keys and menu are the board's. Copied from jerome's
 * PlotBeatCard.tsx.
 */
export function CardTile(props: CardItemProps) {
  const { card, selected, drop, badge, content, onOpen, onMenu, drag, children } = props;
  return (
    <li
      className="eh-board-card"
      data-card-id={card.id}
      data-selected={selected ? "true" : undefined}
      data-drop={drop ? "before" : undefined}
      onContextMenu={onMenu}
      onDoubleClick={openOnDoubleClick(onOpen)}
      {...drag}
    >
      <span
        className="eh-board-card-stripe"
        aria-hidden="true"
        data-none={card.colour === null ? "true" : undefined}
        style={card.colour === null ? undefined : { background: colourVar(card.colour) }}
      />
      <div className="eh-board-card-head">
        <Title {...props} />
        <More {...props} />
      </div>
      {content ?? (
        <>
          {card.summary !== "" && <p className="eh-board-card-summary">{card.summary}</p>}
          {(card.colour !== null || badge) && (
            <div className="eh-board-card-meta">
              {card.colour !== null && <CardColour colour={card.colour} />}
              {badge && <span className="eh-board-badge">{badge}</span>}
            </div>
          )}
        </>
      )}
      {children}
    </li>
  );
}

/**
 * A card as a row of the list: its colour (named), title, summary and the host's badge, or the host's own
 * content. Choosing the title opens the card; the row is dragged to move it, and its keys and menu are the
 * list's. Copied from jerome's PlotBeatRow.tsx.
 */
export function CardRow(props: CardItemProps) {
  const { card, selected, drop, badge, content, onOpen, onMenu, drag, children } = props;
  return (
    <li
      className="eh-board-row"
      data-card-id={card.id}
      data-selected={selected ? "true" : undefined}
      data-drop={drop ? "before" : undefined}
      onContextMenu={onMenu}
      onDoubleClick={openOnDoubleClick(onOpen)}
      {...drag}
    >
      <CardColour colour={card.colour} />
      <Title {...props} />
      <span className="eh-board-row-details">
        {content ?? (
          <>
            {card.summary !== "" && <span className="eh-board-row-summary">{card.summary}</span>}
            {badge && <span className="eh-board-badge">{badge}</span>}
          </>
        )}
      </span>
      <More {...props} />
      {children}
    </li>
  );
}
