import { TestValidator } from "@nestia/e2e";
import factory, { type Expression, type Node, TsPrinter } from "@ttsc/factory";

import { id } from "../../internal/helpers";
import { syntaxErrorOf } from "../../internal/oracle";

const wide = new TsPrinter({ printWidth: 200 });
const tiny = new TsPrinter({ printWidth: 20 });

/** `{ first, ...rest }`, long enough to break at the default width. */
const target = (multiLine?: boolean): Expression =>
  factory.createObjectLiteralExpression(
    [
      factory.createShorthandPropertyAssignment("firstDestructuredBinding"),
      factory.createSpreadAssignment(id("remainingDestructuredBindings")),
    ],
    multiLine,
  );

/**
 * Verifies a broken object destructuring assignment target ending in a rest
 * property drops the synthetic trailing comma.
 *
 * The object half of the same cause as the array target: `({ a, ...rest } =
 * source)` is an `ObjectLiteralExpression`, not a binding pattern, so it took
 * the unguarded literal path, and a comma after its `AssignmentRestProperty` is
 * a `SyntaxError`. The rvalue twin proves the suppression is positional — the
 * identical literal used as a value keeps its break comma, because there the
 * comma is legal.
 *
 * 1. Print the same target through `=`, `for…in`, a nested property target and
 *    `multiLine: true`, flat and broken.
 * 2. Assert every layout compiles in V8.
 * 3. Assert the rvalue twin keeps its trailing comma when it breaks.
 */
export const test_object_target_break_rest_no_trailing_comma = (): void => {
  const cases: [string, Node][] = [
    [
      "assignment",
      factory.createExpressionStatement(
        factory.createAssignment(target(), id("sourceCollectionValue")),
      ),
    ],
    [
      "for-in",
      factory.createForInStatement(
        target(),
        id("sourceCollectionValues"),
        factory.createBlock([]),
      ),
    ],
    [
      "nested property target",
      factory.createExpressionStatement(
        factory.createAssignment(
          factory.createObjectLiteralExpression([
            factory.createPropertyAssignment("propertyName", target()),
          ]),
          id("sourceCollectionValue"),
        ),
      ),
    ],
    [
      "nested behind a spread target",
      factory.createExpressionStatement(
        factory.createAssignment(
          factory.createArrayLiteralExpression([
            factory.createSpreadElement(target()),
          ]),
          id("sourceCollectionValue"),
        ),
      ),
    ],
    [
      "multiLine forces the break at any width",
      factory.createExpressionStatement(
        factory.createAssignment(target(true), id("sourceCollectionValue")),
      ),
    ],
  ];
  for (const [title, node] of cases) {
    const flat: string = wide.print(node);
    const broken: string = tiny.print(node);
    TestValidator.equals(`${title} flat compiles`, syntaxErrorOf(flat), undefined);
    TestValidator.equals(
      `${title} broken compiles`,
      syntaxErrorOf(broken),
      undefined,
    );
    TestValidator.equals(
      `${title} broken has no comma after the rest`,
      /\.\.\.[A-Za-z]+,/.test(broken),
      false,
    );
  }

  // negative twin: the same literal as a value keeps the break comma
  const rvalue: string = tiny.print(
    factory.createVariableStatement(
      undefined,
      factory.createVariableDeclarationList([
        factory.createVariableDeclaration(
          "mergedValue",
          undefined,
          undefined,
          target(),
        ),
      ]),
    ),
  );
  TestValidator.equals(
    "rvalue object spread keeps its trailing comma",
    rvalue.includes("...remainingDestructuredBindings,"),
    true,
  );
  TestValidator.equals("rvalue twin compiles", syntaxErrorOf(rvalue), undefined);
};
