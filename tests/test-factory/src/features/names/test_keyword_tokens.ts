import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";

import { print } from "../../internal/helpers";

/**
 * Verifies printing of literal keyword tokens.
 *
 * `createTrue` / `createFalse` / `createNull` / `createThis` and an explicit
 * `createToken` each render to their keyword text.
 *
 * 1. Keyword tokens retain true, false, null, this and readonly spellings.
 * 2. The explicit keyword/token pairs derive from TypeScript source spellings, not a reverse lookup in the factory printer.
 *
 * @evidence contracts/testing.md#behavioral-verification Keyword tokens retain true, false, null, this and readonly spellings.
 * @evidence contracts/testing.md#independent-expectations The explicit keyword/token pairs derive from TypeScript source spellings, not a reverse lookup in the factory printer.
 * @evidence contracts/testing.md#distinguishing-cases Value-like keywords and modifier readonly cover distinct token roles; keyword types are covered separately.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_keyword_tokens. Calls createTrue/createFalse/createNull/createThis and the readonly createToken row and TsPrinter.print in one unit export.
 */
export const test_keyword_tokens = (): void => {
  TestValidator.equals("true", print(factory.createTrue()), "true");
  TestValidator.equals("false", print(factory.createFalse()), "false");
  TestValidator.equals("null", print(factory.createNull()), "null");
  TestValidator.equals("this", print(factory.createThis()), "this");
  TestValidator.equals(
    "token",
    print(factory.createToken(SyntaxKind.ReadonlyKeyword)),
    "readonly",
  );
};
