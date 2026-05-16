import type { TtscLintFormatConfig } from "./TtscLintFormatConfig";

/**
 * Documented defaults for the `format` block's *always-on* rules
 * (`format/semi`, `format/quotes`, `format/trailing-comma`,
 * `format/print-width`).
 *
 * Exported so users can spread defaults next to overrides:
 *
 *   import { defaultFormat, type TtscLintConfig } from "@ttsc/lint";
 *
 *   export default {
 *     format: { ...defaultFormat, printWidth: 100 },
 *   } satisfies TtscLintConfig;
 *
 * The values mirror Prettier 1:1 except for the documented
 * `endOfLine` narrowing (no `"cr"` / `"auto"`).
 *
 * Notably absent: `importOrder` and `jsdoc`. `format/sort-imports`
 * and `format/jsdoc` are opt-in by setting their corresponding
 * fields; the defaults const only seeds the rules that turn on
 * unconditionally with a non-empty `format` block.
 */
export const defaultFormat = Object.freeze({
  severity: "warning",
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  endOfLine: "lf",
} satisfies TtscLintFormatConfig);
