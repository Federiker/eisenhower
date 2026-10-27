import { QUADRANTS, type Quadrant, type TodoItem } from "@eisenhower/model";
import { type DragEvent, type ReactNode, useId } from "react";

import { Notice } from "../controls/Notice";
import { useTranslate } from "../strings/translate";
import { QuickAdd } from "./QuickAdd";

/** What makes an element take a dragged item: its drop handlers, and `data-drop` while one is over it. */
export type DropZone = {
  "data-drop": "inside" | undefined;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
};

/**
 * The Eisenhower matrix (decision 18): the four quadrants in a 2×2 grid, urgent on the left and important at
 * the top (Do, Schedule; Delegate, Drop). Each is a region named by its heading and described ("Urgent and
 * important"…), with its items or "Nothing here.", and a field that adds an item to it; each takes a dragged
 * item.
 */
export function TodoMatrix({
  quadrants,
  readOnly,
  row,
  dropZone,
  onAdd,
}: {
  /** The items shown in each quadrant, in order. */
  quadrants: Readonly<Record<Quadrant, readonly TodoItem[]>>;
  readOnly: boolean;
  row: (item: TodoItem) => ReactNode;
  dropZone: (quadrant: Quadrant) => DropZone;
  /** Adds an item to a quadrant: null when it was added, otherwise why not. */
  onAdd: (title: string, quadrant: Quadrant) => string | null;
}) {
  const t = useTranslate();
  const id = useId();
  return (
    <div className="eh-todo-matrix">
      {QUADRANTS.map((quadrant) => {
        const name = t(`todo.quadrant.${quadrant}`);
        const items = quadrants[quadrant];
        return (
          <section
            key={quadrant}
            className="eh-todo-quadrant"
            data-quadrant={quadrant}
            aria-labelledby={`${id}-${quadrant}`}
            aria-describedby={`${id}-${quadrant}-about`}
            {...dropZone(quadrant)}
          >
            <h3 id={`${id}-${quadrant}`} className="eh-todo-quadrant-heading">
              {name}
            </h3>
            <p id={`${id}-${quadrant}-about`} className="eh-todo-quadrant-about">
              {t(`todo.quadrantAbout.${quadrant}`)}
            </p>
            {items.length > 0 ? (
              <ol className="eh-todo-items" aria-label={name}>
                {items.map(row)}
              </ol>
            ) : (
              <Notice>{t("todo.quadrantEmpty")}</Notice>
            )}
            {!readOnly && (
              <QuickAdd
                label={t("todo.newItemIn", { quadrant: name })}
                place={quadrant}
                onAdd={(title) => onAdd(title, quadrant)}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}
