import { TestValidator } from "@nestia/e2e";

import factory from "../../../../../packages/factory/src/index";
import { print, ref } from "../../internal/helpers";

/**
 * Verifies printing of a template literal type, e.g. `prefix-${T}-suffix`.
 *
 * Composed from a {@link factory.createTemplateHead|head} and a span pairing a
 * type with a {@link factory.createTemplateTail|tail}.
 *
 * 1. Template literal type output preserves prefix-, the T substitution and
 *    -suffix.
 * 2. Literal `prefix-${T}-suffix` independently specifies segment ordering and
 *    substitution delimiters.
 *
 * @evidence contracts/testing.md#behavioral-verification Template literal type output preserves prefix-, the T substitution and -suffix.
 * @evidence contracts/testing.md#independent-expectations Literal `prefix-${T}-suffix` independently specifies segment ordering and substitution delimiters.
 * @evidence contracts/testing.md#distinguishing-cases This one-span type context complements multi-span expression templates and zero-substitution literals without claiming escape coverage here.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_template_literal_type. Calls createTemplateLiteralType/createTemplateLiteralTypeSpan with head/tail nodes and print.
 */
export const test_template_literal_type = (): void => {
  TestValidator.equals(
    "template literal type",
    print(
      factory.createTemplateLiteralType(factory.createTemplateHead("prefix-"), [
        factory.createTemplateLiteralTypeSpan(
          ref("T"),
          factory.createTemplateTail("-suffix"),
        ),
      ]),
    ),
    "`prefix-${T}-suffix`",
  );
};
