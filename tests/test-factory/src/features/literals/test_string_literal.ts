import { TestValidator } from "@nestia/e2e";
import factory from "@ttsc/factory";

import { print, str } from "../../internal/helpers";

/**
 * Print {@link factory.createStringLiteral|string literals} with escaping.
 *
 * Double quotes are the default; single quotes are opt-in. Embedded quotes and
 * control characters (newline) are escaped.
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
