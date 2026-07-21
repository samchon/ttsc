import { TestValidator } from "@nestia/e2e";
import factory, { type Expression, type Node, SyntaxKind } from "@ttsc/factory";
import ts from "ts-legacy";

import { assertOracle, wide } from "../../internal/oracle";

const f = factory;
const l = ts.factory;
const id = (text: string) => f.createIdentifier(text);
const lid = (text: string) => l.createIdentifier(text);
const qd = () => f.createToken(SyntaxKind.QuestionDotToken);
const lqd = () => l.createToken(ts.SyntaxKind.QuestionDotToken);

const jsxElement = (): Expression =>
  f.createJsxElement(
    f.createJsxOpeningElement(id("Item"), undefined, f.createJsxAttributes([])),
    [],
    f.createJsxClosingElement(id("Item")),
  );
const legacyJsxElement = (): ts.Expression =>
  l.createJsxElement(
    l.createJsxOpeningElement(
      lid("Item"),
      undefined,
      l.createJsxAttributes([]),
    ),
    [],
    l.createJsxClosingElement(lid("Item")),
  );
const jsxSelfClosingElement = (): Expression =>
  f.createJsxSelfClosingElement(
    id("Item"),
    undefined,
    f.createJsxAttributes([]),
  );
const legacyJsxSelfClosingElement = (): ts.Expression =>
  l.createJsxSelfClosingElement(
    lid("Item"),
    undefined,
    l.createJsxAttributes([]),
  );
const jsxFragment = (): Expression =>
  f.createJsxFragment(
    f.createJsxOpeningFragment(),
    [],
    f.createJsxJsxClosingFragment(),
  );
const legacyJsxFragment = (): ts.Expression =>
  l.createJsxFragment(
    l.createJsxOpeningFragment(),
    [],
    l.createJsxJsxClosingFragment(),
  );
const partial = (expression: Expression): Expression =>
  f.createPartiallyEmittedExpression(expression);
const legacyPartial = (expression: ts.Expression): ts.Expression =>
  l.createPartiallyEmittedExpression(expression);

/**
 * Verifies expression union coverage: printable JSX and partial wrappers reach
 * every parenthesizer predicate.
 *
 * `PartiallyEmittedExpression` prints only its inner expression, so treating
 * the wrapper as a primary expression loses parentheses around comma sequences,
 * optional chains, objects, functions, and call-based `new` targets. The public
 * union must also admit every JSX expression form the printer has always
 * rendered. Each expected program comes from the pinned legacy factory and
 * printer, never from this printer's own output.
 *
 * 1. Pass each newly admitted expression through `createExpressionStatement` and
 *    compare JSX output with the legacy printer in TSX mode.
 * 2. Place partial wrappers in left-side, precedence, statement, and new-target
 *    contexts, then compare parsed structures with the legacy oracle.
 */
export const test_expression_union_coverage = (): void => {
  const expressions: readonly Expression[] = [
    jsxElement(),
    jsxSelfClosingElement(),
    jsxFragment(),
    partial(id("value")),
  ];
  const statements: readonly Node[] = expressions.map((expression) =>
    f.createExpressionStatement(expression),
  );
  TestValidator.equals(
    "every newly admitted kind reaches createExpressionStatement",
    statements.map((statement) => statement.kind),
    [
      "ExpressionStatement",
      "ExpressionStatement",
      "ExpressionStatement",
      "ExpressionStatement",
    ],
  );

  for (const [title, expression, oracle] of [
    ["JSX element", jsxElement(), legacyJsxElement()],
    [
      "JSX self-closing element",
      jsxSelfClosingElement(),
      legacyJsxSelfClosingElement(),
    ],
    ["JSX fragment", jsxFragment(), legacyJsxFragment()],
  ] as const)
    assertOracle(
      title,
      wide.print(f.createExpressionStatement(expression)),
      l.createExpressionStatement(oracle),
      ts.ScriptKind.TSX,
    );

  const optional = (): Expression =>
    f.createPropertyAccessChain(id("a"), qd(), "b");
  const legacyOptional = (): ts.Expression =>
    l.createPropertyAccessChain(lid("a"), lqd(), lid("b"));
  const emptyFunction = (): Expression =>
    f.createFunctionExpression(
      undefined,
      undefined,
      undefined,
      undefined,
      [],
      undefined,
      f.createBlock([], true),
    );
  const legacyEmptyFunction = (): ts.Expression =>
    l.createFunctionExpression(
      undefined,
      undefined,
      undefined,
      undefined,
      [],
      undefined,
      l.createBlock([], true),
    );
  const rows: readonly [string, Node, ts.Node][] = [
    [
      "partial identifier is a left-side expression",
      f.createExpressionStatement(
        f.createCallExpression(partial(id("callee")), undefined, []),
      ),
      l.createExpressionStatement(
        l.createCallExpression(legacyPartial(lid("callee")), undefined, []),
      ),
    ],
    [
      "partial optional chain keeps the call outside the chain",
      f.createExpressionStatement(
        f.createCallExpression(partial(optional()), undefined, []),
      ),
      l.createExpressionStatement(
        l.createCallExpression(legacyPartial(legacyOptional()), undefined, []),
      ),
    ],
    [
      "partial comma sequence keeps binary precedence",
      f.createExpressionStatement(
        f.createAdd(
          partial(f.createCommaListExpression([id("a"), id("b")])),
          id("c"),
        ),
      ),
      l.createExpressionStatement(
        l.createAdd(
          legacyPartial(l.createCommaListExpression([lid("a"), lid("b")])),
          lid("c"),
        ),
      ),
    ],
    [
      "nested partial comma sequence keeps binary precedence",
      f.createExpressionStatement(
        f.createAdd(
          partial(partial(f.createCommaListExpression([id("a"), id("b")]))),
          id("c"),
        ),
      ),
      l.createExpressionStatement(
        l.createAdd(
          legacyPartial(
            legacyPartial(l.createCommaListExpression([lid("a"), lid("b")])),
          ),
          lid("c"),
        ),
      ),
    ],
    [
      "partial object literal keeps expression-statement parentheses",
      f.createExpressionStatement(partial(f.createObjectLiteralExpression([]))),
      l.createExpressionStatement(
        legacyPartial(l.createObjectLiteralExpression([])),
      ),
    ],
    [
      "partial function keeps expression-statement parentheses",
      f.createExpressionStatement(partial(emptyFunction())),
      l.createExpressionStatement(legacyPartial(legacyEmptyFunction())),
    ],
    [
      "partial call remains visible to new-target leftmost traversal",
      f.createExpressionStatement(
        f.createNewExpression(
          partial(f.createCallExpression(id("Factory"), undefined, [])),
          undefined,
          [],
        ),
      ),
      l.createExpressionStatement(
        l.createNewExpression(
          legacyPartial(l.createCallExpression(lid("Factory"), undefined, [])),
          undefined,
          [],
        ),
      ),
    ],
  ];
  for (const [title, node, oracle] of rows)
    assertOracle(title, wide.print(node), oracle);
};
