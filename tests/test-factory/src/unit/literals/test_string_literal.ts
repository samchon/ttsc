import { TestValidator } from "@nestia/e2e";
import factory from "../../../../../packages/factory/src/index";

import { print, str } from "../../internal/helpers";

/**
 * Verifies printing of {@link factory.createStringLiteral|string literals} with escaping.
 *
 * Double quotes are the default; single quotes are opt-in. Embedded quotes and
 * control characters (newline) are escaped.
 *
 * 1. String literal emission uses default double or requested single quotes and escapes active quotes/newlines.
 * 2. Exact authored source strings specify delimiter choice and escape bytes independently.
 *
 * @evidence contracts/testing.md#behavioral-verification String literal emission uses default double or requested single quotes and escapes active quotes/newlines.
 * @evidence contracts/testing.md#independent-expectations Exact authored source strings specify delimiter choice and escape bytes independently.
 * @evidence contracts/testing.md#distinguishing-cases Default/opt-in quote styles plus quote and newline payloads distinguish escaping from blanket replacement; hostile controls live in their dedicated case.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_string_literal. Calls createStringLiteral and TsPrinter.print in the source unit executor.
 */
export const test_string_literal = (): void => {
  TestValidator.equals("double", print(str("hello")), '"hello"');
  TestValidator.equals(
    "single",
    print(factory.createStringLiteral("hi", true)),
    "'hi'",
  );
  TestValidator.equals("escape quote", print(str('a"b')), '"a\\"b"');
  TestValidator.equals("escape newline", print(str("a\nb")), '"a\\nb"');
};
