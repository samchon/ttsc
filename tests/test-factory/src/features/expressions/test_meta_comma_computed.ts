import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { id, num, print } from "../../internal/helpers";

/**
 * Print meta-properties, comma lists, computed names, regex, and `super`.
 *
 * `import.meta`, `new.target`, a comma-list expression, a computed object key,
 * a regular-expression literal, and a `super(...)` call.
 */
export const test_meta_comma_computed = (): void => {
  TestValidator.equals(
    "import.meta",
    print(factory.createMetaProperty(SyntaxKind.ImportKeyword, "meta")),
    "import.meta",
  );
  TestValidator.equals(
    "new.target",
    print(factory.createMetaProperty(SyntaxKind.NewKeyword, "target")),
    "new.target",
  );
  TestValidator.equals(
    "comma list",
    print(factory.createCommaListExpression([id("a"), id("b"), id("c")])),
    "a, b, c",
  );
  TestValidator.equals(
    "computed name",
    print(
      factory.createObjectLiteralExpression([
        factory.createPropertyAssignment(
          factory.createComputedPropertyName(id("key")),
          num("1"),
        ),
      ]),
    ),
    "{ [key]: 1 }",
  );
  TestValidator.equals(
    "regex",
    print(factory.createRegularExpressionLiteral("/ab+c/gi")),
    "/ab+c/gi",
  );
  TestValidator.equals(
    "super call",
    print(factory.createCallExpression(factory.createSuper(), undefined, [])),
    "super()",
  );
};
