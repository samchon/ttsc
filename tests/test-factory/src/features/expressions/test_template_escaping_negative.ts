import { TestValidator } from "@nestia/e2e";

import factory from "../../../../../packages/factory/src/index";
import { print } from "../../internal/helpers";

/**
 * Verifies template escaping negatives: legal template text stays verbatim.
 *
 * The negative twins of the `escapeTemplateText` cases in `TsPrinter.ts`.
 * Over-escaping would be invisible to the round-trip tests — `\$` and `\{` cook
 * back to `$` and `{` anyway — so this pins the printed bytes: a `$` not
 * followed by `{`, lone braces, and LF are all legal template text and must
 * print unchanged, and an author-provided `rawText` that is already escaped
 * must stay byte-identical to the cooked-text output it mirrors.
 *
 * 1. Print plain text, `$` without `{`, lone braces, and a real LF; assert each
 *    prints verbatim between backticks.
 * 2. Print a literal whose `rawText` already spells the escaped form and assert
 *    the output is byte-identical to escaping the cooked text.
 *
 * @evidence contracts/testing.md#behavioral-verification Legal template text stays verbatim and already escaped raw text retains exactly one escaped backtick.
 * @evidence contracts/testing.md#independent-expectations Verbatim literal expectations and explicit `a\`b` source independently check bytes; the original raw/cooked equality remains as a complementary assertion.
 * @evidence contracts/testing.md#distinguishing-cases Plain/dollar-without-brace/lone-brace/LF negatives contrast with the preescaped raw backtick and dedicated escaping positives.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_template_escaping_negative. Calls createNoSubstitutionTemplateLiteral and print for each labeled negative and raw-text row.
 */
export const test_template_escaping_negative = (): void => {
  const verbatim: [title: string, text: string][] = [
    ["plain", "plain"],
    ["dollar without brace", "price: 3$ {b} $x $"],
    ["lone braces", "{a} }b{"],
    ["line feed", "line1\nline2"],
  ];
  for (const [title, text] of verbatim)
    TestValidator.equals(
      title,
      print(factory.createNoSubstitutionTemplateLiteral(text)),
      `\`${text}\``,
    );
  TestValidator.equals(
    "pre-escaped rawText literal",
    print(factory.createNoSubstitutionTemplateLiteral("a`b", "a\\`b")),
    "`a\\`b`",
  );
  TestValidator.equals(
    "pre-escaped rawText",
    print(factory.createNoSubstitutionTemplateLiteral("a`b", "a\\`b")),
    print(factory.createNoSubstitutionTemplateLiteral("a`b")),
  );
};
