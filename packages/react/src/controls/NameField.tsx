import { useEffect, useState } from "react";

/**
 * A name edited in place: the change is kept when the field is left or Enter is pressed (a refused one
 * stays in the field to be put right), and Escape puts back the saved name.
 */
export function NameField({
  value,
  label,
  disabled,
  onCommit,
}: {
  value: string;
  label: string;
  disabled: boolean;
  /** Saves the new name; false when it was refused. */
  onCommit: (name: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit() {
    if (draft !== value) void onCommit(draft);
  }

  return (
    <input
      className="eh-name-field"
      aria-label={label}
      value={draft}
      disabled={disabled}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        } else if (event.key === "Escape") {
          setDraft(value);
        }
      }}
    />
  );
}
