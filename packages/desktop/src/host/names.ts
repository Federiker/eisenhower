/** The last part of a path, on Windows, macOS or Linux. */
export const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path;

/** The folder a path is in (everything before its last part); empty for a bare name. */
export function folderOf(path: string): string {
  const cut = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return cut < 0 ? "" : path.slice(0, cut) || path.slice(0, 1);
}

/** The extension the app gives the documents it saves: JSON, which is what a document is. */
export const DOCUMENT_EXTENSION = "json";

/** A file name for a document called `name`: without the characters file systems refuse, ending `.json`. */
export function fileName(name: string): string {
  if (name.toLowerCase().endsWith(`.${DOCUMENT_EXTENSION}`)) return name;
  const safe = name.replace(/[\\/:*?"<>|]/g, "").trim();
  return `${safe || "document"}.${DOCUMENT_EXTENSION}`;
}
