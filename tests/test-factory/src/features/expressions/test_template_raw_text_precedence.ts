import { TestValidator } from "@nestia/e2e";
import factory from "../../../../../packages/factory/src/index";

import { print, str } from "../../internal/helpers";

/**
 * Verifies template rawText precedence: raw spelling prints verbatim.
 *
 * Locks the `templateText` branch in `TsPrinter.ts` that prefers `node.rawText`
 * over escaping the cooked `text`, mirroring the legacy TypeScript emitter
 * where the author owns raw fidelity. The field used to be stored by the
 * factories and never read, so a divergent `text` / `rawText` pair silently
 * printed the cooked text instead of the raw spelling.
 *
 * 1. Create a `NoSubstitutionTemplateLiteral` whose cooked text contains a real
 *    newline but whose `rawText` spells `\n`.
 * 2. Assert the printed output uses the raw spelling.
 * 3. Repeat for a `TemplateExpression` whose head, middle, and tail each carry a
 *    raw escape sequence, and assert the raw forms print verbatim.
 *
 * @evidence contracts/testing.md#behavioral-verification Explicit rawText takes precedence over cooked text in no-substitution, head, middle and tail segments.
 * @evidence contracts/testing.md#independent-expectations Literal escape spellings specify the supplied raw value independently instead of printing the cooked alternative to derive expectations.
 * @evidence contracts/testing.md#distinguishing-cases No-substitution raw newline versus cooked LF and all three interpolated raw slots test precedence propagation.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_template_raw_text_precedence. Calls template-segment constructors with both text and rawText then TsPrinter.print.
 */
export const test_template_raw_text_precedence = (): void => {
  TestValidator.equals(
    "no substitution",
    print(factory.createNoSubstitutionTemplateLiteral("a\nb", "a\\nb")),
    "`a\\nb`",
  );
  TestValidator.equals(
    "head, middle, and tail",
    print(
      factory.createTemplateExpression(
        factory.createTemplateHead("A", "\\u0041"),
        [
          factory.createTemplateSpan(
            str("X"),
            factory.createTemplateMiddle("\t", "\\t"),
          ),
          factory.createTemplateSpan(
            str("Y"),
            factory.createTemplateTail("!", "\\u0021"),
          ),
        ],
      ),
    ),
    '`\\u0041${"X"}\\t${"Y"}\\u0021`',
  );
};
