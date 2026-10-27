/** A pencil, for renaming an item's title in place; hidden from assistive technology (its button is named). */
export function PencilIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor">
      <path d="M11 2.5l2.5 2.5L5.5 13H3v-2.5z" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/** Three dots in a column, for an item's menu button. */
export function MoreIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="8" cy="3" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="8" cy="13" r="1.5" />
    </svg>
  );
}
