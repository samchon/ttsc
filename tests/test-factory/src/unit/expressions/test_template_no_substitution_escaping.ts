import { TestValidator } from "@nestia/e2e";
import factory from "../../../../../packages/factory/src/index";

import { cook, print } from "../../internal/helpers";

/**
 * Verifies no-substitution template escaping: every metacharacter round-trips.
 *
 * Locks the `NoSubstitutionTemplateLiteral` case in `TsPrinter.ts` onto
 * `escapeTemplateText`. The printer used to emit the cooked text verbatim, so a
 * backtick terminated the literal early, `${` became live interpolation
 * (template injection), a backslash re-cooked following characters, a trailing
 * backslash swallowed the closing backtick, and CR / CRLF were normalized to LF
 * by the scanner — parse errors and silent value changes.
 *
 * 1. Create a `NoSubstitutionTemplateLiteral` per metacharacter: backtick, `${`,
 *    lone backslash, `\u`-lookalike, trailing backslash, CR, CRLF.
 * 2. Print each and assert the exact escaped output.
 * 3. Re-parse the printed source and assert the cooked value is unchanged.
 */
export const test_template_no_substitution_escaping = (): void => {
  const cases: [title: string, cooked: string, printed: string][] = [
    ["backtick", "a`b", "`a\\`b`"],
    ["substitution", "cost: ${price}", "`cost: \\${price}`"],
    ["lone backslash", "C:\\temp", "`C:\\\\temp`"],
    ["unicode lookalike", "\\u0041", "`\\\\u0041`"],
    ["trailing backslash", "end\\", "`end\\\\`"],
    ["carriage return", "a\rb", "`a\\rb`"],
    ["crlf", "a\r\nb", "`a\\r\\nb`"],
  ];
  for (const [title, cooked, printed] of cases) {
    const output: string = print(
      factory.createNoSubstitutionTemplateLiteral(cooked),
    );
    TestValidator.equals(`${title}: printed`, output, printed);
    TestValidator.equals(`${title}: round-trip`, cook(output), cooked);
  }
};
