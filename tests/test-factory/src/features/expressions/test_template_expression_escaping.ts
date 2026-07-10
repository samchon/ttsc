import { TestValidator } from "@nestia/e2e";
import factory from "@ttsc/factory";

import { cook, id, print, str } from "../../internal/helpers";

/**
 * Verifies multi-span template escaping: head, middle, and tail round-trip.
 *
 * Locks the `TemplateHead` / `TemplateMiddle` / `TemplateTail` cases in
 * `TsPrinter.ts` onto the same `escapeTemplateText` helper as the
 * no-substitution case. The spans share one code path with
 * `NoSubstitutionTemplateLiteral`, so verbatim emission corrupted multi-span
 * templates identically — a backtick in the head closed the literal, `${` in
 * the middle became a live substitution, and a trailing backslash in the tail
 * escaped the closing backtick. The tagged-template path reuses the same
 * emission and is pinned here too.
 *
 * 1. Build a `TemplateExpression` whose head, middle, and tail each carry a
 *    backtick, `${`, and a backslash, and collectively carry CR, CRLF, and a
 *    trailing backslash, with string-literal substitutions.
 * 2. Print it and assert the exact escaped output.
 * 3. Re-parse the printed source and assert the concatenated cooked value.
 * 4. Print a `TaggedTemplateExpression` over an escaped literal and assert the
 *    exact output.
 */
export const test_template_expression_escaping = (): void => {
  const head: string = "a`b${c\\d\r";
  const middle: string = "e`f${g\\h\r\n";
  const tail: string = "i`j${k\\l\\";
  const output: string = print(
    factory.createTemplateExpression(factory.createTemplateHead(head), [
      factory.createTemplateSpan(
        str("X"),
        factory.createTemplateMiddle(middle),
      ),
      factory.createTemplateSpan(str("Y"), factory.createTemplateTail(tail)),
    ]),
  );
  TestValidator.equals(
    "printed",
    output,
    '`a\\`b\\${c\\\\d\\r${"X"}e\\`f\\${g\\\\h\\r\\n${"Y"}i\\`j\\${k\\\\l\\\\`',
  );
  TestValidator.equals("round-trip", cook(output), `${head}X${middle}Y${tail}`);
  TestValidator.equals(
    "tagged",
    print(
      factory.createTaggedTemplateExpression(
        id("tag"),
        undefined,
        factory.createNoSubstitutionTemplateLiteral("a`b"),
      ),
    ),
    "tag`a\\`b`",
  );
};
