import { TestValidator } from "@nestia/e2e";
import factory, { type Expression, type Node, TsPrinter } from "@ttsc/factory";

import { id } from "../../internal/helpers";
import { syntaxErrorOf } from "../../internal/oracle";

const wide = new TsPrinter({ printWidth: 200 });
const tiny = new TsPrinter({ printWidth: 20 });

/** `[first, second, ...rest]`, long enough to break at the default width. */
const target = (multiLine?: boolean): Expression =>
  factory.createArrayLiteralExpression(
    [
      id("firstDestructuredBinding"),
      id("secondDestructuredBinding"),
      factory.createSpreadElement(id("remainingDestructuredBindings")),
    ],
    multiLine,
  );

/**
 * Verifies a broken array destructuring assignment target ending in a rest
 * element drops the synthetic trailing comma.
 *
 * An array literal is not only an rvalue: the same node kind is how a
 * destructuring assignment target is represented, and ECMAScript forbids a
 * comma after an `AssignmentRestElement`. The width-break comma therefore
 * decided whether the printed text ran at all — with ordinary identifiers, at
 * the _default_ `printWidth`, so the same generator emitted working code while
 * its names were short and a `SyntaxError` once they grew. Every route into
 * target position is covered, because the flag is threaded from the emitting
 * site rather than read off a parent link.
 *
 * 1. Print the same target through `=`, `createAssignment`, `for…of`, a nested
 *    inner target, and `multiLine: true`, flat and broken.
 * 2. Assert every layout compiles in V8, which is what rejects the comma.
 * 3. Assert the broken layout of the plain (non-rest) twin still gains its
 *    trailing comma, so the suppression is scoped to the rest element.
 */
export const test_array_target_break_rest_no_trailing_comma = (): void => {
  const cases: [string, Node][] = [
    [
      "assignment",
      factory.createExpressionStatement(
        factory.createAssignment(target(), id("sourceCollectionValue")),
      ),
    ],
    [
      "for-of",
      factory.createForOfStatement(
        undefined,
        target(),
        id("sourceCollectionValues"),
        factory.createBlock([]),
      ),
    ],
    [
      "nested inner target",
      factory.createExpressionStatement(
        factory.createAssignment(
          factory.createArrayLiteralExpression([
            id("outerBindingName"),
            target(),
          ]),
          id("sourceCollectionValue"),
        ),
      ),
    ],
    [
      "inside a default",
      factory.createExpressionStatement(
        factory.createAssignment(
          factory.createArrayLiteralExpression([
            factory.createAssignment(target(), id("fallbackCollectionValue")),
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
    TestValidator.equals(
      `${title} flat compiles`,
      syntaxErrorOf(flat),
      undefined,
    );
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
  TestValidator.equals(
    "the broken layout really breaks",
    tiny
      .print(
        factory.createExpressionStatement(
          factory.createAssignment(target(), id("sourceCollectionValue")),
        ),
      )
      .includes("\n"),
    true,
  );

  // negative twin: the same shape without a rest keeps the break comma
  const plain: string = tiny.print(
    factory.createExpressionStatement(
      factory.createAssignment(
        factory.createArrayLiteralExpression([
          id("firstDestructuredBinding"),
          id("secondDestructuredBinding"),
          id("thirdDestructuredBinding"),
        ]),
        id("sourceCollectionValue"),
      ),
    ),
  );
  TestValidator.equals(
    "plain last element keeps its trailing comma",
    plain.includes("thirdDestructuredBinding,"),
    true,
  );
  TestValidator.equals("plain twin compiles", syntaxErrorOf(plain), undefined);
};
