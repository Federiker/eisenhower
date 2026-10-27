export {
  addDays,
  addMonths,
  type CalendarDay,
  calendarDaySchema,
  compareDays,
  dayAsDate,
  dayNumber,
  dayOfNumber,
  dayParts,
  daysBetween,
  daysInMonth,
  isCalendarDay,
  isLeapYear,
  isoWeekday,
  startOfMonth,
  startOfWeek,
  today,
} from "./common/days";
export { idSchema, MAX_ID_LENGTH, newId, uniqueIds } from "./common/ids";
export { type Colour, colourSchema, PALETTE_SIZE } from "./common/palette";
export { done, type EditResult, type Problem, refused } from "./common/result";
export {
  characterCount,
  freeName,
  MAX_NAME_LENGTH,
  MAX_SUMMARY_LENGTH,
  nameFits,
  nameProblem,
  oneLineFits,
} from "./common/text";
export {
  type LoadedDocument,
  loadDocument,
  saveDocument,
  type StorageAdapter,
  StorageError,
  type StorageProblem,
  type StoredText,
  textRevision,
} from "./storage/adapter";
export {
  type DocumentKind,
  type DocumentKindName,
  DocumentError,
  type DocumentProblem,
  type EisenhowerDocument,
  parseDocument,
  serialiseDocument,
} from "./storage/document";
export { localStorageAdapter } from "./storage/local";
export { memoryStorage } from "./storage/memory";
