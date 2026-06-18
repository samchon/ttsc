import { TestValidator } from "@nestia/e2e";
import factory from "@ttsc/factory";

import { id, print } from "../../internal/helpers";

/**
 * Print template strings.
 *
 * A single-substitution template, a multi-substitution template (head + middle
 *
 * - Tail), a tagged template, and a no-substitution template literal.
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
