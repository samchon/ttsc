import type { ITtscLintFormat } from "./structures/format/ITtscLintFormat";

/**
 * Documented defaults for the `format` block's _always-on_ rules
 * (`format/semi`, `format/quotes`, `format/arrow-parens`,
 * `format/bracket-spacing`, `format/quote-props`, `format/trailing-comma`,
 * `format/print-width`).
 *
 * Exported so users can spread defaults next to overrides:
 *
 * ```ts
 * import { type ITtscLintConfig, defaultFormat } from "@ttsc/lint";
 *
 * export default {
 *   format: { ...defaultFormat, printWidth: 100 },
 * } satisfies ITtscLintConfig;
 * ```
 *
 * The values mirror Prettier 1:1 except for the documented `endOfLine`
 * narrowing (no `"cr"` / `"auto"`).
 *
 * Notably absent: `sortImports`. Import sorting is opt-in by setting
 * `sortImports`; JSDoc normalization is always on (set `jsDoc: false` to opt
 * out). This const documents only the keys that turn on unconditionally with a
 * non-empty `format` block; the Go host owns runtime activation.
 */
export const defaultFormat = Object.freeze({
  severity: "off",
  semi: true,
  singleQuote: false,
  arrowParens: "always",
  bracketSpacing: true,
  quoteProps: "as-needed",
  trailingComma: "all",
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  endOfLine: "lf",
} satisfies ITtscLintFormat);
