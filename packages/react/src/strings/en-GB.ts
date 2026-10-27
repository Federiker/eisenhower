import { common } from "./en-GB/common";
import { gantt } from "./en-GB/gantt";

/**
 * The interface text in UK English (decision 6), one message a key. Placeholders are written `{name}`;
 * plurals are objects keyed by the categories of `Intl.PluralRules`. A host overrides any of them with the
 * `strings` prop, or routes every key through its own translations with the `t` prop.
 *
 * Each area keeps its messages in a file of its own under `en-GB/`, with its own key prefix (`common.*`,
 * `board.*`, `timeline.*`, `gantt.*`, `todo.*`), spread here.
 */
export const enGB = {
  ...common,
  ...gantt,
} as const;

export type MessageKey = keyof typeof enGB;
export type Message = string | Readonly<Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }>;
export type Strings = { readonly [key in MessageKey]: Message };
