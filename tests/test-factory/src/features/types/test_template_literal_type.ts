import { TestValidator } from "@nestia/e2e";
import factory from "@ttsc/factory";

import { print, ref } from "../../internal/helpers";

/**
 * Print a template literal type, e.g. `prefix-${T}-suffix`.
 *
 * Composed from a {@link factory.createTemplateHead|head} and a span pairing a
 * type with a {@link factory.createTemplateTail|tail}.
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
