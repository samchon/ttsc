import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { print } from "../../internal/helpers";

/**
 * Print literal keyword tokens.
 *
 * `createTrue` / `createFalse` / `createNull` / `createThis` and an explicit
 * `createToken` each render to their keyword text.
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
