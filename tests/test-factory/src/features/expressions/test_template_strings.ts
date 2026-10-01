import { TestValidator } from "@nestia/e2e";
import factory from "../../../../../packages/factory/src/index";

import { id, print } from "../../internal/helpers";

/**
 * Verifies printing of template strings.
 *
 * A single-substitution template, a multi-substitution template (head + middle
 *
 * - Tail), a tagged template, and a no-substitution template literal.
 *
 * 1. Single/multiple spans, tagged templates and no-substitution templates preserve text, substitutions and tag identity.
 * 2. Exact independent template-source literals define backticks, ${} delimiters and segment order.
 *
 * @evidence contracts/testing.md#behavioral-verification Single/multiple spans, tagged templates and no-substitution templates preserve text, substitutions and tag identity.
 * @evidence contracts/testing.md#independent-expectations Exact independent template-source literals define backticks, ${} delimiters and segment order.
 * @evidence contracts/testing.md#distinguishing-cases Zero/one/multiple substitutions and tagged versus untagged shapes complement hostile escape-specific cases.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_template_strings. Calls template expression/span/tagged/no-substitution constructors and print directly.
 */
export const test_template_strings = (): void => {
  TestValidator.equals(
    "single span",
    print(
      factory.createTemplateExpression(factory.createTemplateHead("Hello, "), [
        factory.createTemplateSpan(id("name"), factory.createTemplateTail("!")),
      ]),
    ),
    "`Hello, ${name}!`",
  );
  TestValidator.equals(
    "multi span",
    print(
      factory.createTemplateExpression(factory.createTemplateHead("a"), [
        factory.createTemplateSpan(id("b"), factory.createTemplateMiddle("c")),
        factory.createTemplateSpan(id("d"), factory.createTemplateTail("e")),
      ]),
    ),
    "`a${b}c${d}e`",
  );
  TestValidator.equals(
    "tagged",
    print(
      factory.createTaggedTemplateExpression(
        id("tag"),
        undefined,
        factory.createNoSubstitutionTemplateLiteral("text"),
      ),
    ),
    "tag`text`",
  );
  TestValidator.equals(
    "no substitution",
    print(factory.createNoSubstitutionTemplateLiteral("plain")),
    "`plain`",
  );
};
