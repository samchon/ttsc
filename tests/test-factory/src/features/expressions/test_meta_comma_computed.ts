import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";

import { id, num, print } from "../../internal/helpers";

/**
 * Verifies printing of meta-properties, comma lists, computed names, regex, and `super`.
 *
 * `import.meta`, `new.target`, a comma-list expression, a computed object key,
 * a regular-expression literal, and a `super(...)` call.
 *
 * 1. Meta properties, comma lists, computed property names, regex literals and super calls retain their distinct syntax.
 * 2. Explicit import.meta/new.target, comma, computed key, regex and super literals specify the supplied source independently.
 *
 * @evidence contracts/testing.md#behavioral-verification Meta properties, comma lists, computed property names, regex literals and super calls retain their distinct syntax.
 * @evidence contracts/testing.md#independent-expectations Explicit import.meta/new.target, comma, computed key, regex and super literals specify the supplied source independently.
 * @evidence contracts/testing.md#distinguishing-cases The heterogeneous constructors cover dedicated syntax not reducible to identifiers; regex body/flags and comma order must survive.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_meta_comma_computed. Calls createMetaProperty/createCommaListExpression/createComputedPropertyName/createRegularExpressionLiteral and super call construction before print.
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
