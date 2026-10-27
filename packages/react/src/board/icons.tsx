/** The board's two icons, drawn in the text colour and hidden from assistive technology (their buttons are named). */

/** Three dots in a column: a menu of more actions. */
export function MoreIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="8" cy="3" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="8" cy="13" r="1.5" />
    </svg>
  );
}

/** A pencil: edit the text beside it. */
export function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    >
      <path d="M11 2.5 13.5 5 5.5 13H3v-2.5z" />
      <path d="M9.5 4 12 6.5" />
    </svg>
  );
}
