/** The last part of a path, on Windows, macOS or Linux. */
export const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path;

/** The folder a path is in (everything before its last part); empty for a bare name. */
export function folderOf(path: string): string {
  const cut = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return cut < 0 ? "" : path.slice(0, cut) || path.slice(0, 1);
}

/** The extension the app gives the documents it saves: `.ike`, whose content is the document's JSON. */
export const DOCUMENT_EXTENSION = "ike";

/** The extensions Open… accepts: the app's own, and `.json`, which documents were saved as before. */
export const OPEN_EXTENSIONS = [DOCUMENT_EXTENSION, "json"] as const;

/** A document's extension at the end of a name (either case), which a name shown or suggested leaves out. */
const KNOWN_EXTENSION = /\.(ike|json)$/i;

/** A document's name as the start screen lists it: its file's name without `.ike` or `.json`. */
export const documentName = (path: string) => baseName(path).replace(KNOWN_EXTENSION, "") || baseName(path);

/**
 * A file name for a document called `name` (or a file's name, for Save as…): without the characters file
 * systems refuse and without `.ike` or `.json`, then ending `.ike`.
 */
export function fileName(name: string): string {
  const safe = name
    .replace(/[\\/:*?"<>|]/g, "")
    .trim()
    .replace(KNOWN_EXTENSION, "")
    .trim();
  return `${safe || "document"}.${DOCUMENT_EXTENSION}`;
}
