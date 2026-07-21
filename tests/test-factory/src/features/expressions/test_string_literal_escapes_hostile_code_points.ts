import { TestValidator } from "@nestia/e2e";
import factory from "@ttsc/factory";

import { print } from "../../internal/helpers";

/**
 * Verifies a string literal prints a value a JavaScript engine reads back
 * unchanged.
 *
 * The escape set was the backslash, LF, CR, TAB and the active quote, and
 * everything else went out raw. That is three separate hazards: a C0 control or
 * DEL lands in the generated file as itself; U+2028 and U+2029 terminate a
 * string literal in any engine predating ES2019, so the emitted program does
 * not parse; and a lone surrogate becomes U+FFFD once the text is written as
 * UTF-8, so the generated program holds a different string than the caller
 * built. `@ttsc/factory` exists to generate source, so a value that does not
 * survive its own printer is the defect this package is written to prevent.
 *
 * Inputs are spelled with `String.fromCharCode` so the fixture itself carries
 * no raw control character.
 *
 * 1. Print literals holding each hazardous code point.
 * 2. Assert each is escaped, and that a well-formed astral pair is not.
 * 3. Assert the inactive quote stays as written under both quote styles.
 */
export const test_string_literal_escapes_hostile_code_points = (): void => {
  const lit = (text: string, singleQuote?: boolean): string =>
    print(factory.createStringLiteral(text, singleQuote));
  const around = (code: number): string => `a${String.fromCharCode(code)}b`;

  const escapes: [string, number, string][] = [
    ["nul", 0x00, "\\x00"],
    ["bell", 0x07, "\\x07"],
    ["backspace", 0x08, "\\b"],
    ["vertical tab", 0x0b, "\\v"],
    ["form feed", 0x0c, "\\f"],
    ["delete", 0x7f, "\\x7f"],
    ["line separator", 0x2028, "\\u2028"],
    ["paragraph separator", 0x2029, "\\u2029"],
    ["lone high surrogate", 0xd800, "\\ud800"],
    ["lone low surrogate", 0xdc00, "\\udc00"],
  ];
  for (const [name, code, escape] of escapes)
    TestValidator.equals(name, lit(around(code)), `"a${escape}b"`);

  // A well-formed astral pair is one character and needs no escape.
  TestValidator.equals("astral pair", lit("a\u{1f600}b"), '"a\u{1f600}b"');

  // The quote that is not delimiting the literal is ordinary text; the one that
  // is gets escaped.
  TestValidator.equals(
    "double quote inside single",
    lit('say "hi"', true),
    `'say "hi"'`,
  );
  TestValidator.equals("single quote inside double", lit("it's"), `"it's"`);
  TestValidator.equals("active quote escaped", lit("it's", true), `'it\\'s'`);
};
