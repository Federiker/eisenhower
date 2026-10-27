import { createContext, useContext } from "react";

import { enGB, type Message, type MessageKey, type Strings } from "./en-GB";

/** Values for a message's placeholders; `count` also picks a plural form. */
export type MessageValues = Readonly<Record<string, string | number>>;

/** Turns a key and its values into text: the views' own, or the host's (decision 6). */
export type Translate = (key: MessageKey, values?: MessageValues) => string;

/** The locale the views format dates and numbers in when the host gives none. */
export const DEFAULT_LOCALE = "en-GB";

function fill(text: string, values: MessageValues, locale: string): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = values[name];
    if (value === undefined) return whole;
    return typeof value === "number" ? new Intl.NumberFormat(locale).format(value) : value;
  });
}

function pick(message: Message, values: MessageValues, locale: string): string {
  if (typeof message === "string") return message;
  const count =
    typeof values.count === "number"
      ? values.count
      : Number(Object.values(values).find((v) => typeof v === "number") ?? 0);
  const category = new Intl.PluralRules(locale).select(count);
  return message[category] ?? message.other;
}

/**
 * A translator from the views' messages with the host's overrides: a partial `strings` object replaces
 * messages, a `t` function replaces the lookup altogether (falling back to the built-in message when it
 * returns the key itself or nothing).
 */
export function createTranslate(
  options: { strings?: Partial<Strings>; t?: Translate; locale?: string } = {},
): Translate {
  const locale = options.locale ?? DEFAULT_LOCALE;
  const messages: Strings = { ...enGB, ...options.strings };
  return (key, values = {}) => {
    const hosted = options.t?.(key, values);
    if (hosted && hosted !== key) return hosted;
    return fill(pick(messages[key], values, locale), values, locale);
  };
}

const TranslateContext = createContext<Translate>(createTranslate());
const LocaleContext = createContext<string>(DEFAULT_LOCALE);

export const TranslateProvider = TranslateContext.Provider;
export const LocaleProvider = LocaleContext.Provider;

/** The translator of the view or provider around this component (UK English outside any). */
export function useTranslate(): Translate {
  return useContext(TranslateContext);
}

/** The locale dates and numbers are formatted in (`Intl`): the host's, or "en-GB". */
export function useLocale(): string {
  return useContext(LocaleContext);
}
