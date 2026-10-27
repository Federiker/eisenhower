/** The last part of a path, on Windows, macOS or Linux. */
export const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path;

/** The extension the desktop app gives the documents it saves: JSON, which is what a document is. */
export const DOCUMENT_EXTENSION = "json";

/** A file name for a document called `name`: without the characters file systems refuse, ending `.json`. */
export function fileName(name: string): string {
  if (name.toLowerCase().endsWith(`.${DOCUMENT_EXTENSION}`)) return name;
  const safe = name.replace(/[\\/:*?"<>|]/g, "").trim();
  return `${safe || "document"}.${DOCUMENT_EXTENSION}`;
}
