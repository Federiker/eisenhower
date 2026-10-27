import { createContext, type HTMLAttributes, type ReactNode, useContext, useMemo } from "react";

import type { Strings } from "../strings/en-GB";
import {
  createTranslate,
  DEFAULT_LOCALE,
  LocaleProvider,
  type Translate,
  TranslateProvider,
} from "../strings/translate";

/** The theme: the system's colour scheme (`system`, the default), or always `light` or `dark`. */
export type Theme = "light" | "dark" | "system";

/**
 * What a host sets for the views (decisions 5 and 6): message overrides (`strings`, a partial object), or a
 * translator for every key (`t`, falling back to the built-in message when it returns the key or nothing);
 * the `locale` dates and numbers are formatted in (`Intl`, default "en-GB"); and the `theme`.
 */
export type EisenhowerSettings = {
  strings?: Partial<Strings>;
  t?: Translate;
  locale?: string;
  theme?: Theme;
};

type ElementProps = Omit<HTMLAttributes<HTMLDivElement>, "children">;

const SettingsContext = createContext<EisenhowerSettings | null>(null);

/** The settings of an inner provider or view over those around it: the inner ones win, key by key. */
function merge(outer: EisenhowerSettings | null, inner: EisenhowerSettings): EisenhowerSettings {
  if (!outer) return inner;
  const outerT = outer.t;
  const innerStrings = inner.strings;
  return {
    strings: { ...outer.strings, ...innerStrings },
    // The inner strings win over the outer translator, which is asked only for the keys they leave.
    t:
      inner.t ??
      (outerT && innerStrings
        ? (key, values) => (innerStrings[key] === undefined ? outerT(key, values) : key)
        : outerT),
    locale: inner.locale ?? outer.locale,
    theme: inner.theme ?? outer.theme,
  };
}

/**
 * The settings in context and the element around their content: `.eh-root`, which carries the theme's
 * variables, unless `themed` is false (the content then takes the variables of the root around it).
 */
function Scope({
  settings,
  themed,
  baseClass,
  className,
  children,
  ...rest
}: ElementProps & { settings: EisenhowerSettings; themed: boolean; baseClass: string; children: ReactNode }) {
  const { strings, t, locale, theme = "system" } = settings;
  const translate = useMemo(() => createTranslate({ strings, t, locale }), [strings, t, locale]);
  return (
    <SettingsContext.Provider value={settings}>
      <TranslateProvider value={translate}>
        <LocaleProvider value={locale ?? DEFAULT_LOCALE}>
          <div
            {...rest}
            className={[themed ? "eh-root" : null, baseClass, className].filter(Boolean).join(" ")}
            data-theme={themed && theme !== "system" ? theme : undefined}
          >
            {children}
          </div>
        </LocaleProvider>
      </TranslateProvider>
    </SettingsContext.Provider>
  );
}

/**
 * Sets the strings, translator, locale and theme of every view inside it, drawn in a `div.eh-root` that
 * carries the theme (with `data-theme` when it is not the system's). Providers nest: an inner one's settings
 * win over the outer one's. Other props (`className`, `style` with `--eh-*` overrides…) go to the div.
 */
export function EisenhowerProvider({
  strings,
  t,
  locale,
  theme,
  children,
  ...rest
}: EisenhowerSettings & ElementProps & { children: ReactNode }) {
  const outer = useContext(SettingsContext);
  const settings = useMemo(() => merge(outer, { strings, t, locale, theme }), [outer, strings, t, locale, theme]);
  return (
    <Scope {...rest} settings={settings} themed baseClass="eh-provider">
      {children}
    </Scope>
  );
}

/**
 * The element each view draws around itself, so that a view works alone with its own `strings`, `t`,
 * `locale` and `theme` props, or inside an `EisenhowerProvider` (its props win over the provider's, key by
 * key). Alone, or with its own `theme`, it is a `div.eh-root` that carries the theme; inside a provider it
 * is a plain `div` that takes the provider's variables, including a host's overrides there.
 *
 * ```tsx
 * export function Board({ strings, t, locale, theme, ...props }: BoardProps) {
 *   return (
 *     <ViewRoot strings={strings} t={t} locale={locale} theme={theme} className="eh-board">
 *       <BoardContent {...props} />
 *     </ViewRoot>
 *   );
 * }
 * ```
 */
export function ViewRoot({
  strings,
  t,
  locale,
  theme,
  children,
  ...rest
}: EisenhowerSettings & ElementProps & { children: ReactNode }) {
  const outer = useContext(SettingsContext);
  const settings = useMemo(() => merge(outer, { strings, t, locale, theme }), [outer, strings, t, locale, theme]);
  return (
    <Scope {...rest} settings={settings} themed={outer === null || theme !== undefined} baseClass="eh-view">
      {children}
    </Scope>
  );
}
