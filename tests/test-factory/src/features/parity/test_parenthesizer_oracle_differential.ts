import { TestValidator } from "@nestia/e2e";
import factory, { type Expression, type Node, SyntaxKind } from "@ttsc/factory";
import ts from "ts-legacy";

import { kindsOf, printLegacy, structure, wide } from "../../internal/oracle";

const f = factory;
const l = ts.factory;
const id = (text: string) => f.createIdentifier(text);
const lid = (text: string) => l.createIdentifier(text);
const qd = () => f.createToken(SyntaxKind.QuestionDotToken);
const lqd = () => l.createToken(ts.SyntaxKind.QuestionDotToken);

/** One operand shape, built once for each printer. */
interface Operand {
  name: string;
  ttsc: () => Expression;
  legacy: () => ts.Expression;
}
/** One position that consumes an operand, built once for each printer. */
interface Consumer {
  name: string;
  ttsc: (operand: Expression) => Node;
  legacy: (operand: ts.Expression) => ts.Node;
}

const operands: Operand[] = [
  {
    name: "property chain",
    ttsc: () => f.createPropertyAccessChain(id("a"), qd(), "b"),
    legacy: () => l.createPropertyAccessChain(lid("a"), lqd(), lid("b")),
  },
  {
    name: "element chain",
    ttsc: () =>
      f.createElementAccessChain(id("a"), qd(), f.createNumericLiteral("0")),
    legacy: () =>
      l.createElementAccessChain(lid("a"), lqd(), l.createNumericLiteral("0")),
  },
  {
    name: "call chain",
    ttsc: () => f.createCallChain(id("a"), qd(), undefined, []),
    legacy: () => l.createCallChain(lid("a"), lqd(), undefined, []),
  },
  {
    name: "non-null chain",
    ttsc: () => f.createNonNullChain(f.createPropertyAccessChain(id("a"), qd(), "b")),
    legacy: () =>
      l.createNonNullChain(l.createPropertyAccessChain(lid("a"), lqd(), lid("b"))),
  },
  {
    name: "chain whose head is a chain",
    ttsc: () =>
      f.createPropertyAccessChain(
        f.createCallChain(id("a"), qd(), undefined, []),
        qd(),
        "b",
      ),
    legacy: () =>
      l.createPropertyAccessChain(
        l.createCallChain(lid("a"), lqd(), undefined, []),
        lqd(),
        lid("b"),
      ),
  },
  {
    name: "call",
    ttsc: () => f.createCallExpression(id("a"), undefined, []),
    legacy: () => l.createCallExpression(lid("a"), undefined, []),
  },
  {
    name: "property access",
    ttsc: () => f.createPropertyAccessExpression(id("a"), "b"),
    legacy: () => l.createPropertyAccessExpression(lid("a"), lid("b")),
  },
  {
    name: "identifier",
    ttsc: () => id("a"),
    legacy: () => lid("a"),
  },
  {
    name: "logical or",
    ttsc: () => f.createBinaryExpression(id("X"), SyntaxKind.BarBarToken, id("Y")),
    legacy: () =>
      l.createBinaryExpression(lid("X"), ts.SyntaxKind.BarBarToken, lid("Y")),
  },
  {
    name: "conditional",
    ttsc: () =>
      f.createConditionalExpression(id("c"), undefined, id("X"), undefined, id("Y")),
    legacy: () =>
      l.createConditionalExpression(
        lid("c"),
        undefined,
        lid("X"),
        undefined,
        lid("Y"),
      ),
  },
  {
    name: "as expression over a call",
    ttsc: () =>
      f.createAsExpression(
        f.createCallExpression(id("g"), undefined, []),
        f.createTypeReferenceNode("any"),
      ),
    legacy: () =>
      l.createAsExpression(
        l.createCallExpression(lid("g"), undefined, []),
        l.createTypeReferenceNode("any", undefined),
      ),
  },
  {
    name: "await",
    ttsc: () => f.createAwaitExpression(id("Base")),
    legacy: () => l.createAwaitExpression(lid("Base")),
  },
  {
    name: "arrow function",
    ttsc: () =>
      f.createArrowFunction(undefined, undefined, [], undefined, undefined, id("x")),
    legacy: () =>
      l.createArrowFunction(undefined, undefined, [], undefined, undefined, lid("x")),
  },
  {
    name: "assignment",
    ttsc: () => f.createAssignment(id("X"), id("Y")),
    legacy: () => l.createAssignment(lid("X"), lid("Y")),
  },
  {
    name: "comma sequence",
    ttsc: () => f.createBinaryExpression(id("a"), SyntaxKind.CommaToken, id("B")),
    legacy: () =>
      l.createBinaryExpression(lid("a"), ts.SyntaxKind.CommaToken, lid("B")),
  },
  {
    name: "function expression",
    ttsc: () =>
      f.createFunctionExpression(
        undefined,
        undefined,
        undefined,
        undefined,
        [],
        undefined,
        f.createBlock([]),
      ),
    legacy: () =>
      l.createFunctionExpression(
        undefined,
        undefined,
        undefined,
        undefined,
        [],
        undefined,
        l.createBlock([]),
      ),
  },
  {
    name: "object literal",
    ttsc: () => f.createObjectLiteralExpression([]),
    legacy: () => l.createObjectLiteralExpression([]),
  },
  {
    name: "new without arguments",
    ttsc: () => f.createNewExpression(id("N"), undefined, undefined),
    legacy: () => l.createNewExpression(lid("N"), undefined, undefined),
  },
  {
    name: "new with arguments",
    ttsc: () => f.createNewExpression(id("N"), undefined, []),
    legacy: () => l.createNewExpression(lid("N"), undefined, []),
  },
];

const statement = (expression: Expression): Node =>
  f.createExpressionStatement(expression);
const legacyStatement = (expression: ts.Expression): ts.Node =>
  l.createExpressionStatement(expression);

const consumers: Consumer[] = [
  {
    name: "call",
    ttsc: (o) => statement(f.createCallExpression(o, undefined, [])),
    legacy: (o) => legacyStatement(l.createCallExpression(o, undefined, [])),
  },
  {
    name: "new target",
    ttsc: (o) => statement(f.createNewExpression(o, undefined, [])),
    legacy: (o) => legacyStatement(l.createNewExpression(o, undefined, [])),
  },
  {
    name: "new target through a property access",
    ttsc: (o) =>
      statement(
        f.createNewExpression(
          f.createPropertyAccessExpression(o, "bar"),
          undefined,
          [],
        ),
      ),
    legacy: (o) =>
      legacyStatement(
        l.createNewExpression(
          l.createPropertyAccessExpression(o, lid("bar")),
          undefined,
          [],
        ),
      ),
  },
  {
    name: "property access",
    ttsc: (o) => statement(f.createPropertyAccessExpression(o, "c")),
    legacy: (o) => legacyStatement(l.createPropertyAccessExpression(o, lid("c"))),
  },
  {
    name: "element access",
    ttsc: (o) =>
      statement(f.createElementAccessExpression(o, f.createNumericLiteral("1"))),
    legacy: (o) =>
      legacyStatement(
        l.createElementAccessExpression(o, l.createNumericLiteral("1")),
      ),
  },
  {
    name: "non-null assertion",
    ttsc: (o) => statement(f.createNonNullExpression(o)),
    legacy: (o) => legacyStatement(l.createNonNullExpression(o)),
  },
  {
    name: "tagged template tag",
    ttsc: (o) =>
      statement(
        f.createTaggedTemplateExpression(
          o,
          undefined,
          f.createNoSubstitutionTemplateLiteral("x"),
        ),
      ),
    legacy: (o) =>
      legacyStatement(
        l.createTaggedTemplateExpression(
          o,
          undefined,
          l.createNoSubstitutionTemplateLiteral("x"),
        ),
      ),
  },
  {
    name: "property chain",
    ttsc: (o) => statement(f.createPropertyAccessChain(o, qd(), "c")),
    legacy: (o) => legacyStatement(l.createPropertyAccessChain(o, lqd(), lid("c"))),
  },
  {
    name: "element chain",
    ttsc: (o) =>
      statement(f.createElementAccessChain(o, qd(), f.createNumericLiteral("1"))),
    legacy: (o) =>
      legacyStatement(
        l.createElementAccessChain(o, lqd(), l.createNumericLiteral("1")),
      ),
  },
  {
    name: "call chain",
    ttsc: (o) => statement(f.createCallChain(o, qd(), undefined, [])),
    legacy: (o) => legacyStatement(l.createCallChain(o, lqd(), undefined, [])),
  },
  {
    name: "non-null chain",
    ttsc: (o) => statement(f.createNonNullChain(o)),
    legacy: (o) => legacyStatement(l.createNonNullChain(o)),
  },
  {
    name: "postfix update",
    ttsc: (o) =>
      statement(f.createPostfixUnaryExpression(o, SyntaxKind.PlusPlusToken)),
    legacy: (o) =>
      legacyStatement(
        l.createPostfixUnaryExpression(o, ts.SyntaxKind.PlusPlusToken),
      ),
  },
  {
    name: "typeof operand",
    ttsc: (o) => statement(f.createTypeOfExpression(o)),
    legacy: (o) => legacyStatement(l.createTypeOfExpression(o)),
  },
  {
    name: "decorator",
    ttsc: (o) =>
      f.createClassDeclaration([f.createDecorator(o)], "A", undefined, undefined, []),
    legacy: (o) =>
      l.createClassDeclaration(
        [l.createDecorator(o)],
        lid("A"),
        undefined,
        undefined,
        [],
      ),
  },
  {
    name: "class extends",
    ttsc: (o) => heritage(SyntaxKind.ExtendsKeyword, [o]),
    legacy: (o) => legacyHeritage(ts.SyntaxKind.ExtendsKeyword, [o]),
  },
  {
    name: "class implements",
    ttsc: (o) => heritage(SyntaxKind.ImplementsKeyword, [id("P"), o]),
    legacy: (o) => legacyHeritage(ts.SyntaxKind.ImplementsKeyword, [lid("P"), o]),
  },
  {
    name: "class extends with type arguments",
    ttsc: (o) => heritage(SyntaxKind.ExtendsKeyword, [o], true),
    legacy: (o) => legacyHeritage(ts.SyntaxKind.ExtendsKeyword, [o], true),
  },
  {
    name: "class expression extends",
    ttsc: (o) =>
      statement(
        f.createClassExpression(
          undefined,
          "C",
          undefined,
          [
            f.createHeritageClause(SyntaxKind.ExtendsKeyword, [
              f.createExpressionWithTypeArguments(o, undefined),
            ]),
          ],
          [],
        ),
      ),
    legacy: (o) =>
      legacyStatement(
        l.createClassExpression(
          undefined,
          lid("C"),
          undefined,
          [
            l.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
              l.createExpressionWithTypeArguments(o, undefined),
            ]),
          ],
          [],
        ),
      ),
  },
  {
    name: "interface extends",
    ttsc: (o) =>
      f.createInterfaceDeclaration(
        undefined,
        "I",
        undefined,
        [
          f.createHeritageClause(SyntaxKind.ExtendsKeyword, [
            f.createExpressionWithTypeArguments(o, undefined),
          ]),
        ],
        [],
      ),
    legacy: (o) =>
      l.createInterfaceDeclaration(
        undefined,
        lid("I"),
        undefined,
        [
          l.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
            l.createExpressionWithTypeArguments(o, undefined),
          ]),
        ],
        [],
      ),
  },
  {
    name: "expression statement",
    ttsc: (o) => statement(o),
    legacy: (o) => legacyStatement(o),
  },
  {
    name: "export default",
    ttsc: (o) => f.createExportAssignment(undefined, false, o),
    legacy: (o) => l.createExportAssignment(undefined, false, o),
  },
  {
    name: "arrow concise body",
    ttsc: (o) =>
      statement(
        f.createArrowFunction(undefined, undefined, [], undefined, undefined, o),
      ),
    legacy: (o) =>
      legacyStatement(
        l.createArrowFunction(undefined, undefined, [], undefined, undefined, o),
      ),
  },
];

/**
 * The one cell where the legacy printer's own text does not mean what its own
 * tree says, so the differential cannot use it as an oracle.
 *
 * `isLeftHandSideExpression` is true for an object literal upstream, so the
 * legacy printer emits `class A extends {}<T> {}`, which re-parses as a type
 * assertion `<T>{}` and loses the heritage clause outright. This printer treats
 * an object literal as needing parentheses and emits `class A extends ({})<T>
 * {}`, which round-trips. The expected text is asserted directly instead.
 */
const oracleUnfaithful: ReadonlySet<string> = new Set([
  "class extends with type arguments / object literal",
]);

const heritage = (
  token: SyntaxKind,
  expressions: readonly Expression[],
  typeArguments: boolean = false,
): Node =>
  f.createClassDeclaration(
    undefined,
    "A",
    undefined,
    [
      f.createHeritageClause(
        token,
        expressions.map((e) =>
          f.createExpressionWithTypeArguments(
            e,
            typeArguments ? [f.createTypeReferenceNode("T")] : undefined,
          ),
        ),
      ),
    ],
    [],
  );
const legacyHeritage = (
  token: ts.SyntaxKind.ExtendsKeyword | ts.SyntaxKind.ImplementsKeyword,
  expressions: readonly ts.Expression[],
  typeArguments: boolean = false,
): ts.Node =>
  l.createClassDeclaration(
    undefined,
    lid("A"),
    undefined,
    [
      l.createHeritageClause(
        token,
        expressions.map((e) =>
          l.createExpressionWithTypeArguments(
            e,
            typeArguments ? [l.createTypeReferenceNode("T", undefined)] : undefined,
          ),
        ),
      ),
    ],
    [],
  );

/**
 * Every operand kind this differential must be able to place in every consuming
 * position. The generator is checked against this list, so a production that
 * stops being generated fails the case instead of silently shrinking coverage.
 *
 * This is the guard the three earlier fuzzing rounds lacked: sweeps of 1,312,
 * 5,000 and 100,000 cases all reported this parenthesizer clean because no
 * generator could emit an optional chain or a heritage clause at all. Case
 * count is not coverage; the grammar is.
 */
const requiredProductions: readonly string[] = [
  "PropertyAccessChain",
  "ElementAccessChain",
  "CallChain",
  "NonNullChain",
  "PropertyAccessExpression",
  "ElementAccessExpression",
  "CallExpression",
  "NewExpression",
  "NonNullExpression",
  "TaggedTemplateExpression",
  "PostfixUnaryExpression",
  "Decorator",
  "ExpressionWithTypeArguments",
  "HeritageClause",
  "ClassDeclaration",
  "ClassExpression",
  "InterfaceDeclaration",
  "ExportAssignment",
  "ArrowFunction",
  "FunctionExpression",
  "BinaryExpression",
  "ConditionalExpression",
  "AsExpression",
  "AwaitExpression",
  "TypeOfExpression",
  "ObjectLiteralExpression",
];

/**
 * Verifies every operand position the parenthesizer owns prints text that means
 * what the legacy printer's text for the same tree means.
 *
 * The corpus is a full cross product of consuming positions and operand shapes,
 * built twice — once with `@ttsc/factory`, once with the pinned `ts-legacy`
 * factory — so no expectation comes from the printer under test. Comparison is
 * structural, not byte-wise: printed text is parsed back and reduced to its
 * node-kind tree with parentheses removed and optional-chain membership
 * recorded, which ignores formatting while still separating `a?.b()` from
 * `(a?.b)()`.
 *
 * 1. Build every consumer-over-operand pair with both factories.
 * 2. Assert the generated corpus actually contains every required production,
 *    so a grammar gap fails rather than passing vacuously.
 * 3. Assert each printed text parses cleanly and reduces to the same structure
 *    as the oracle's text.
 */
export const test_parenthesizer_oracle_differential = (): void => {
  const generated: Set<string> = new Set();
  const failures: string[] = [];
  let count: number = 0;
  for (const consumer of consumers)
    for (const operand of operands) {
      const title: string = `${consumer.name} / ${operand.name}`;
      const node: Node = consumer.ttsc(operand.ttsc());
      for (const kind of kindsOf(node)) generated.add(kind);
      count++;
      if (oracleUnfaithful.has(title)) continue;
      const printed: string = wide.print(node);
      let actual: string;
      try {
        actual = structure(printed);
      } catch (error) {
        failures.push(`${title}: ${(error as Error).message}`);
        continue;
      }
      const expected: string = structure(
        printLegacy(consumer.legacy(operand.legacy())),
      );
      if (actual !== expected)
        failures.push(
          `${title}: ${JSON.stringify(printed)}\n    actual   ${actual}\n    expected ${expected}`,
        );
    }

  TestValidator.equals(
    "every required production is generated",
    requiredProductions.filter((kind) => !generated.has(kind)),
    [],
  );
  TestValidator.equals(
    "corpus size",
    count,
    consumers.length * operands.length,
  );
  TestValidator.equals("differential failures", failures, []);

  // the excluded cell, asserted directly: the oracle's own text loses its
  // heritage clause, so only this printer's text is checked to round-trip
  TestValidator.equals(
    "object literal base with type arguments round-trips",
    wide.print(
      heritage(SyntaxKind.ExtendsKeyword, [f.createObjectLiteralExpression([])], true),
    ),
    "class A extends ({})<T> {}",
  );
};
