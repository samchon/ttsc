import type { ITtscLintFormat } from "./structures/ITtscLintFormat";

/**
 * Documented defaults for the `format` block's _always-on_ rules
 * (`format/semi`, `format/quotes`, `format/trailing-comma`,
 * `format/print-width`).
 *
 * Exported so users can spread defaults next to overrides:
 *
 * ```ts
 * import { defaultFormat, type ITtscLintConfig } from "@ttsc/lint";
 *
 * export default {
 *   format: { ...defaultFormat, printWidth: 100 },
 * } satisfies ITtscLintConfig;
 * ```
 *
 * The values mirror Prettier 1:1 except for the documented `endOfLine`
 * narrowing (no `"cr"` / `"auto"`).
 *
 * Notably absent: `importOrder` and `jsdoc`. `format/sort-imports` and
 * `format/jsdoc` are opt-in by setting their corresponding fields; this
 * const documents only the rules that turn on unconditionally with a
 * non-empty `format` block — the Go host owns runtime activation.
 */
export const defaultFormat = Object.freeze({
  severity: "off",
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  endOfLine: "lf",
} satisfies ITtscLintFormat);
