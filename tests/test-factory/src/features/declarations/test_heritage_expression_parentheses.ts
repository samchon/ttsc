import { TestValidator } from "@nestia/e2e";
import factory, { type Expression, SyntaxKind } from "@ttsc/factory";
import ts from "ts-legacy";

import { id } from "../../internal/helpers";
import { assertOracle, parseDiagnostics, wide } from "../../internal/oracle";

const lid = (text: string) => ts.factory.createIdentifier(text);

const extendsClass = (expression: Expression) =>
  factory.createClassDeclaration(
    undefined,
    "A",
    undefined,
    [
      factory.createHeritageClause(SyntaxKind.ExtendsKeyword, [
        factory.createExpressionWithTypeArguments(expression, undefined),
      ]),
    ],
    [],
  );
const legacyExtendsClass = (expression: ts.Expression) =>
  ts.factory.createClassDeclaration(
    undefined,
    lid("A"),
    undefined,
    [
      ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
        ts.factory.createExpressionWithTypeArguments(expression, undefined),
      ]),
    ],
    [],
  );

/**
 * Verifies a heritage-clause expression is parenthesized when the grammar
 * requires a `LeftHandSideExpression` there.
 *
 * `ExpressionWithTypeArguments` was the one expression-operand position still
 * emitted with a raw `this.emit`, so `class A extends (X || Y) {}` printed
 * without its parentheses and did not compile (TS1005), while a parenthesized
 * comma sequence silently became _two_ base classes — a single `extends` entry
 * turning into two. Every `extends` and `implements` clause on a class
 * declaration, class expression or interface funnels through this one branch.
 * Expectations come from the legacy printer's output for the same tree.
 *
 * 1. Print a class `extends` clause over each non-left-hand-side expression shape,
 *    and assert the printed text parses and means what the oracle's text
 *    means.
 * 2. Repeat the comma sequence through `implements`, a class expression and an
 *    interface, since all four share the branch.
 * 3. Assert the negative twins — a call and a qualified name — stay bare.
 */
export const test_heritage_expression_parentheses = (): void => {
  const rows: [string, Expression, ts.Expression, string][] = [
    [
      "logical or",
      factory.createBinaryExpression(id("X"), SyntaxKind.BarBarToken, id("Y")),
      ts.factory.createBinaryExpression(
        lid("X"),
        ts.SyntaxKind.BarBarToken,
        lid("Y"),
      ),
      "class A extends (X || Y) {}",
    ],
    [
      "conditional",
      factory.createConditionalExpression(
        id("c"),
        undefined,
        id("X"),
        undefined,
        id("Y"),
      ),
      ts.factory.createConditionalExpression(
        lid("c"),
        undefined,
        lid("X"),
        undefined,
        lid("Y"),
      ),
      "class A extends (c ? X : Y) {}",
    ],
    [
      "as expression",
      factory.createAsExpression(
        id("Base"),
        factory.createKeywordTypeNode(SyntaxKind.AnyKeyword),
      ),
      ts.factory.createAsExpression(
        lid("Base"),
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
      ),
      "class A extends (Base as any) {}",
    ],
    [
      "await",
      factory.createAwaitExpression(id("Base")),
      ts.factory.createAwaitExpression(lid("Base")),
      "class A extends (await Base) {}",
    ],
    [
      "arrow function",
      factory.createArrowFunction(
        undefined,
        undefined,
        [],
        undefined,
        undefined,
        id("x"),
      ),
      ts.factory.createArrowFunction(
        undefined,
        undefined,
        [],
        undefined,
        undefined,
        lid("x"),
      ),
      "class A extends (() => x) {}",
    ],
    [
      "assignment",
      factory.createAssignment(id("X"), id("Y")),
      ts.factory.createAssignment(lid("X"), lid("Y")),
      "class A extends (X = Y) {}",
    ],
    [
      "optional chain",
      factory.createPropertyAccessChain(
        id("m"),
        factory.createToken(SyntaxKind.QuestionDotToken),
        "Base",
      ),
      ts.factory.createPropertyAccessChain(
        lid("m"),
        ts.factory.createToken(ts.SyntaxKind.QuestionDotToken),
        lid("Base"),
      ),
      "class A extends (m?.Base) {}",
    ],
  ];
  for (const [title, expression, oracle, expected] of rows) {
    const printed: string = wide.print(extendsClass(expression));
    TestValidator.equals(title, printed, expected);
    assertOracle(title, printed, legacyExtendsClass(oracle));
  }

  // the comma sequence is the silent one: without parentheses it parses, as two
  // base classes rather than one
  const comma = () =>
    factory.createBinaryExpression(id("a"), SyntaxKind.CommaToken, id("B"));
  const legacyComma = () =>
    ts.factory.createBinaryExpression(
      lid("a"),
      ts.SyntaxKind.CommaToken,
      lid("B"),
    );
  const baseCount = (text: string): number => {
    const file: ts.SourceFile = ts.createSourceFile(
      "case.ts",
      text,
      ts.ScriptTarget.Latest,
      true,
    );
    TestValidator.equals("comma sequence parses", parseDiagnostics(file), []);
    let count = -1;
    const visit = (node: ts.Node): void => {
      if (count < 0 && ts.isHeritageClause(node)) count = node.types.length;
      ts.forEachChild(node, visit);
    };
    visit(file);
    return count;
  };
  const commaExtends: string = wide.print(extendsClass(comma()));
  TestValidator.equals(
    "comma sequence stays one base class",
    baseCount(commaExtends),
    1,
  );
  assertOracle(
    "comma sequence",
    commaExtends,
    legacyExtendsClass(legacyComma()),
  );

  const implementsClass: string = wide.print(
    factory.createClassDeclaration(
      undefined,
      "A",
      undefined,
      [
        factory.createHeritageClause(SyntaxKind.ImplementsKeyword, [
          factory.createExpressionWithTypeArguments(id("P"), undefined),
          factory.createExpressionWithTypeArguments(comma(), undefined),
        ]),
      ],
      [],
    ),
  );
  TestValidator.equals(
    "implements keeps two entries",
    baseCount(implementsClass),
    2,
  );
  assertOracle(
    "implements",
    implementsClass,
    ts.factory.createClassDeclaration(
      undefined,
      lid("A"),
      undefined,
      [
        ts.factory.createHeritageClause(ts.SyntaxKind.ImplementsKeyword, [
          ts.factory.createExpressionWithTypeArguments(lid("P"), undefined),
          ts.factory.createExpressionWithTypeArguments(
            legacyComma(),
            undefined,
          ),
        ]),
      ],
      [],
    ),
  );

  const classExpression: string = wide.print(
    factory.createExpressionStatement(
      factory.createClassExpression(
        undefined,
        "C",
        undefined,
        [
          factory.createHeritageClause(SyntaxKind.ExtendsKeyword, [
            factory.createExpressionWithTypeArguments(comma(), undefined),
          ]),
        ],
        [],
      ),
    ),
  );
  TestValidator.equals(
    "class expression keeps one base class",
    baseCount(classExpression),
    1,
  );
  assertOracle(
    "class expression",
    classExpression,
    ts.factory.createExpressionStatement(
      ts.factory.createClassExpression(
        undefined,
        lid("C"),
        undefined,
        [
          ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
            ts.factory.createExpressionWithTypeArguments(
              legacyComma(),
              undefined,
            ),
          ]),
        ],
        [],
      ),
    ),
  );

  const interfaceExtends: string = wide.print(
    factory.createInterfaceDeclaration(
      undefined,
      "I",
      undefined,
      [
        factory.createHeritageClause(SyntaxKind.ExtendsKeyword, [
          factory.createExpressionWithTypeArguments(comma(), undefined),
        ]),
      ],
      [],
    ),
  );
  TestValidator.equals(
    "interface keeps one base",
    baseCount(interfaceExtends),
    1,
  );

  // an expression carrying type arguments as well as parentheses
  const withTypeArguments: string = wide.print(
    factory.createClassDeclaration(
      undefined,
      "A",
      undefined,
      [
        factory.createHeritageClause(SyntaxKind.ExtendsKeyword, [
          factory.createExpressionWithTypeArguments(
            factory.createAsExpression(
              id("Base"),
              factory.createTypeReferenceNode("any"),
            ),
            [factory.createTypeReferenceNode("T")],
          ),
        ]),
      ],
      [],
    ),
  );
  TestValidator.equals(
    "type arguments follow the parentheses",
    withTypeArguments,
    "class A extends (Base as any)<T> {}",
  );

  // negative twins
  TestValidator.equals(
    "mixin call stays bare",
    wide.print(
      extendsClass(
        factory.createCallExpression(id("mixin"), undefined, [id("Base")]),
      ),
    ),
    "class A extends mixin(Base) {}",
  );
  TestValidator.equals(
    "qualified name stays bare",
    wide.print(
      factory.createInterfaceDeclaration(
        undefined,
        "I",
        undefined,
        [
          factory.createHeritageClause(SyntaxKind.ExtendsKeyword, [
            factory.createExpressionWithTypeArguments(
              factory.createPropertyAccessExpression(id("a"), "B"),
              undefined,
            ),
          ]),
        ],
        [],
      ),
    ),
    "interface I extends a.B {}",
  );
};
