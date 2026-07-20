import { TestValidator } from "@nestia/e2e";
import factory, { type Expression, TsPrinter } from "@ttsc/factory";
import ts from "ts-legacy";

import { str } from "../../internal/helpers";
import { printLegacy, structure } from "../../internal/oracle";

const wide = new TsPrinter({ printWidth: 200 });
const tiny = new TsPrinter({ printWidth: 20 });

const arity = (text: string): number => {
  const file: ts.SourceFile = ts.createSourceFile(
    "case.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
  );
  let length = -1;
  const visit = (node: ts.Node): void => {
    if (length < 0 && ts.isArrayLiteralExpression(node))
      length = node.elements.length;
    ts.forEachChild(node, visit);
  };
  visit(file);
  return length;
};

/**
 * Verifies an array literal ending in an elision keeps its hole at every width.
 *
 * A trailing `OmittedExpression` prints as nothing, so the comma before it is
 * the token that materializes the hole: `["a", "b", ]` has two elements and
 * `["a", "b", ,]` has three. Leaving that comma to the width break made the
 * same node a two-element array on one line and a three-element array once it
 * wrapped. The legacy printer emits the comma in both layouts, so this printer
 * does too — the direction is taken from the oracle, not from either of this
 * printer's own previous layouts, which disagreed with each other.
 *
 * 1. Print an array literal ending in an elision flat, broken, and with
 *    `multiLine: true`.
 * 2. Assert every layout re-parses to the same arity as the legacy printer's
 *    text for the same tree, and means the same thing structurally.
 * 3. Assert the boundary cases — a lone hole and an interior hole — behave the
 *    same way.
 */
export const test_array_literal_break_trailing_elision = (): void => {
  const trailing = (multiLine?: boolean): Expression =>
    factory.createArrayLiteralExpression(
      [str("alphaAlphaAlpha"), str("bravoBravoBravo"), factory.createOmittedExpression()],
      multiLine,
    );
  const legacyTrailing = (multiLine?: boolean): ts.Expression =>
    ts.factory.createArrayLiteralExpression(
      [
        ts.factory.createStringLiteral("alphaAlphaAlpha"),
        ts.factory.createStringLiteral("bravoBravoBravo"),
        ts.factory.createOmittedExpression(),
      ],
      multiLine,
    );

  const oracle: string = printLegacy(
    ts.factory.createExpressionStatement(legacyTrailing()),
  );
  TestValidator.equals("oracle arity", arity(oracle), 3);

  const flat: string = wide.print(factory.createExpressionStatement(trailing()));
  const broken: string = tiny.print(factory.createExpressionStatement(trailing()));
  const forced: string = wide.print(
    factory.createExpressionStatement(trailing(true)),
  );
  TestValidator.equals("flat stays on one line", flat.includes("\n"), false);
  TestValidator.equals("broken layout breaks", broken.includes("\n"), true);
  TestValidator.equals("multiLine breaks at any width", forced.includes("\n"), true);
  for (const [title, text] of [
    ["flat", flat],
    ["broken", broken],
    ["multiLine", forced],
  ] as const)
    TestValidator.equals(`${title} arity`, arity(text), arity(oracle));
  TestValidator.equals("flat means what the oracle means", structure(flat), structure(oracle));
  TestValidator.equals(
    "broken means what the oracle means",
    structure(broken),
    structure(oracle),
  );

  // boundary: a lone hole is still a one-element array
  const lone: string = wide.print(
    factory.createExpressionStatement(
      factory.createArrayLiteralExpression([factory.createOmittedExpression()]),
    ),
  );
  TestValidator.equals(
    "lone hole matches the oracle",
    lone,
    printLegacy(
      ts.factory.createExpressionStatement(
        ts.factory.createArrayLiteralExpression([
          ts.factory.createOmittedExpression(),
        ]),
      ),
    ),
  );
  TestValidator.equals("lone hole arity", arity(lone), 1);

  // negative twin: an interior hole is untouched, in both layouts
  const interior = () =>
    factory.createExpressionStatement(
      factory.createArrayLiteralExpression([
        str("alphaAlphaAlpha"),
        factory.createOmittedExpression(),
        str("bravoBravoBravo"),
      ]),
    );
  TestValidator.equals("interior hole flat arity", arity(wide.print(interior())), 3);
  TestValidator.equals("interior hole broken arity", arity(tiny.print(interior())), 3);
};
