import { Button, TextField } from "@eisenhower/react";
import { type FormEvent, type RefObject, useEffect, useId, useRef, useState } from "react";

import { NEW_TYPES, type NewType } from "./documents";
import { folderOf } from "./host/names";
import { APP_KEYS } from "./keys";
import type { RecentDocument } from "./recent";
import { fill, appStrings as text } from "./strings";

/**
 * The first screen: the recent documents, the latest first, each opened with a click; Open… for another file;
 * and the new document's form, its type and name, created with Create… (which asks where to save it).
 */
export function StartScreen({
  recent,
  locale,
  onOpenRecent,
  onOpen,
  onCreate,
  nameField,
}: {
  recent: readonly RecentDocument[];
  locale: string;
  onOpenRecent: (document: RecentDocument) => void;
  onOpen: () => void;
  /** Creates the document; resolves once it is created, or the user cancelled. */
  onCreate: (type: NewType, name: string) => Promise<void>;
  /** The name's field, which Ctrl+N focuses. */
  nameField: RefObject<HTMLInputElement | null>;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  // The focus goes to the screen's heading as it shows (unless Ctrl+N has put it in the name's field).
  useEffect(() => {
    if (document.activeElement !== nameField.current) heading.current?.focus();
  }, [nameField]);

  return (
    <main className="app-main start">
      <h2 className="eh-visually-hidden" ref={heading} tabIndex={-1}>
        {text.start}
      </h2>
      <section className="start-section" aria-labelledby="start-recent">
        <div className="start-heading">
          <h3 id="start-recent">{text.recent}</h3>
          <Button onClick={onOpen} aria-keyshortcuts={APP_KEYS.open}>
            {text.open}
          </Button>
        </div>
        {recent.length === 0 ? (
          <p className="start-empty">{text.noRecent}</p>
        ) : (
          <ul className="start-recent">
            {recent.map((document) => (
              <li key={document.path}>
                <button type="button" className="start-recent-item" onClick={() => onOpenRecent(document)}>
                  <span className="start-recent-name">{document.name}</span>
                  <span className="start-recent-kind">{text.kinds[document.kind]}</span>
                  <span className="start-recent-folder">{folderOf(document.path)}</span>
                  <span className="start-recent-when">
                    {fill(text.recentOpened, { when: when.format(new Date(document.opened)) })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <NewDocumentForm onCreate={onCreate} nameField={nameField} />
    </main>
  );
}

/** The new document's type and name; Create… asks where to save it, then opens it. */
function NewDocumentForm({
  onCreate,
  nameField,
}: {
  onCreate: (type: NewType, name: string) => Promise<void>;
  nameField: RefObject<HTMLInputElement | null>;
}) {
  const id = useId();
  const [type, setType] = useState<NewType>("board");
  const [name, setName] = useState("");
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setMissing(true);
      nameField.current?.focus();
      return;
    }
    setBusy(true);
    try {
      await onCreate(type, trimmed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="start-section" aria-labelledby={`${id}-heading`}>
      <h3 id={`${id}-heading`}>{text.newDocument}</h3>
      <form className="start-new" onSubmit={(event) => void submit(event)} aria-labelledby={`${id}-heading`}>
        <fieldset className="start-types">
          <legend>{text.newType}</legend>
          {NEW_TYPES.map((one) => (
            <label key={one} className="start-type">
              <input
                type="radio"
                name={`${id}-type`}
                value={one}
                checked={type === one}
                onChange={() => setType(one)}
              />
              {text.types[one]}
            </label>
          ))}
        </fieldset>
        <div className="start-name">
          <label htmlFor={`${id}-name`}>{text.newName}</label>
          <TextField
            id={`${id}-name`}
            ref={nameField}
            value={name}
            aria-keyshortcuts={APP_KEYS.new}
            aria-invalid={missing || undefined}
            aria-describedby={missing ? `${id}-missing` : undefined}
            onChange={(event) => {
              setName(event.target.value);
              setMissing(false);
            }}
          />
          {missing && (
            <p id={`${id}-missing`} className="start-problem">
              {text.newNameMissing}
            </p>
          )}
        </div>
        <Button type="submit" variant="primary" disabled={busy}>
          {text.create}
        </Button>
      </form>
    </section>
  );
}
