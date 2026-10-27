/**
 * The messages the controls, the theme and the shared keys use, in UK English (decision 6). Every view's
 * messages are in a file of their own beside this one (board.ts, timeline.ts…), spread into `enGB`.
 */
export const common = {
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.edit": "Edit",
  "common.rename": "Rename",
  "common.delete": "Delete",
  "common.moveUp": "Move up",
  "common.moveDown": "Move down",
  "common.menuNothing": "Nothing to do here.",
  "common.moveTitle": "Move to",
  "common.moveTitleNamed": "Move to: {name}",
  "common.moveConfirm": "Move",

  "common.colour.orange": "Orange",
  "common.colour.skyBlue": "Sky blue",
  "common.colour.bluishGreen": "Bluish green",
  "common.colour.yellow": "Yellow",
  "common.colour.blue": "Blue",
  "common.colour.vermilion": "Vermilion",
  "common.colour.reddishPurple": "Reddish purple",
  "common.colour.black": "Black",

  "common.keys.focusUp": "Focus the item above",
  "common.keys.focusDown": "Focus the item below",
  "common.keys.focusLeft": "Focus the item to the left",
  "common.keys.focusRight": "Focus the item to the right",
  "common.keys.focusFirst": "Focus the first item",
  "common.keys.focusLast": "Focus the last item",
  "common.keys.moveUp": "Move the item up",
  "common.keys.moveDown": "Move the item down",
  "common.keys.moveLeft": "Move the item to the left",
  "common.keys.moveRight": "Move the item to the right",
  "common.keys.open": "Open or edit the item; in a field, save",
  "common.keys.saveText": "Save a text of several lines",
  "common.keys.rename": "Rename the item",
  "common.keys.delete": "Delete the item",
  "common.keys.menu": "Open the item's menu",
  "common.keys.escape": "Close the menu or dialog, or cancel the edit",
} as const;
