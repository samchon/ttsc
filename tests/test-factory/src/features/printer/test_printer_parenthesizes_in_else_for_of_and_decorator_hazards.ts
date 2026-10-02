import { TestValidator } from "@nestia/e2e";
import ts from "ts-legacy";

import factory, {
  type Node,
  NodeFlags,
  SyntaxKind,
  TsPrinter,
} from "../../../../../packages/factory/src/index";
import { id, print } from "../../internal/helpers";
import { parseClean } from "../../internal/oracle";

const f = factory;

/** One tree with the text it must print as and the tree that text must parse to. */
interface Case {
  name: string;
  text: string;
  tree: () => Node;
  /** The legacy parse outline of the literal; absent for the else cases. */
  shape?: string;
  /** Whether the outer if and its innermost then-branch if carry an else. */
  elses?: [boolean, boolean];
}

/**
 * Kind names of a parsed node and its children, parentheses kept. Operator
 * tokens print as `[text]` and a numeric literal as its own name, because
 * several kinds share one numeric alias.
 */
const shapeOf = (node: ts.Node): string => {
  const children: string[] = [];
  node.forEachChild((child) => void children.push(shapeOf(child)));
  const punctuation: string | undefined =
    node.kind >= ts.SyntaxKind.FirstPunctuation &&
    node.kind <= ts.SyntaxKind.LastPunctuation
      ? ts.tokenToString(node.kind)
      : undefined;
  const name: string =
    punctuation !== undefined ? `[${punctuation}]` : ts.SyntaxKind[node.kind]!;
  return children.length === 0 ? name : `${name}(${children.join(",")})`;
};

/** The innermost `if` statement under `node`, descending through every child. */
const innermostIf = (node: ts.Node): ts.IfStatement | undefined => {
  let found: ts.IfStatement | undefined;
  node.forEachChild((child) => {
    const inner: ts.IfStatement | undefined = innermostIf(child);
    if (inner !== undefined) found = inner;
  });
  return found ?? (ts.isIfStatement(node) ? node : undefined);
};

const inExpression = () =>
  f.createBinaryExpression(
    f.createStringLiteral("a"),
    SyntaxKind.InKeyword,
    id("b"),
  );
const IN = "BinaryExpression(StringLiteral,InKeyword,Identifier)";
const forInit = (initializer: ReturnType<typeof inExpression> | Node) =>
  f.createForStatement(
    initializer as never,
    undefined,
    undefined,
    f.createEmptyStatement(),
  );

/**
 * Verifies the printer parenthesizes `in` inside a `for` initializer, braces a
 * then-branch that would capture an `else`, and keeps the groupings a `for...of`
 * target, a decorator and a `>` chain need.
 *
 * `in` at the top level of a `for` initializer ends the initializer and starts a
 * `for...in`, so it needs parentheses there and nowhere inside brackets or a
 * conditional's consequent. An `else` binds to the nearest unmatched `if`, so a
 * then-branch that ends in an `if` without an `else` must be wrapped in a block
 * even when the statement is a loop or label around that `if`.
 *
 * 1. Print `for` initializers holding an `in` expression in a declaration, bare,
 *    an array element and a member-chain receiver, and in a conditional
 *    consequent that needs no parentheses.
 * 2. Print an `if/else` whose then-branch is an `if`, a `while`, a `for` or a
 *    label around one, with an unbraced and a braced then-branch, and the
 *    neighbors that need no block.
 * 3. Print a `for...of` over a comma list, a decorator on an element access, and
 *    `>`, `>>` and neighbors at a width where other operators break.
 *
 * @evidence contracts/testing.md#behavioral-verification Prints each tree with TsPrinter and requires the exact authored text; the else cases additionally parse the text and require the innermost `if` to carry no `else`, so the printed braces provably keep the else on the outer statement.
 * @evidence contracts/testing.md#independent-expectations The literals follow the ECMAScript grammar (the `[~In]` initializer, the dangling-else rule, `for (x of AssignmentExpression)`, a decorator's parenthesized member expression, which forbids `@d[e]`); each is parsed by the pinned legacy parser and its tree compared with an authored kind outline, so the oracle is the grammar and not the printer's own text. The legacy printer is not used because it prints the same trees with the hazards unprotected.
 * @evidence contracts/testing.md#distinguishing-cases The bare, declaration, array and receiver `in` positions are contrasted with the consequent that stays unparenthesized; a then-branch if, while, for and label are contrasted with an else-less outer if, an if/else inner and a plain statement that print without a block; `>` and `>>` contrast with `<`, `>>>` and `>=` at the same width, which break after the operator.
 * @evidence contracts/testing.md#execution-ownership Factory unit entry that builds nodes with the factories and prints them in process; the legacy parser is only the grammar reference. No compiler, process or file runs.
 */
export const test_printer_parenthesizes_in_else_for_of_and_decorator_hazards =
  (): void => {
    const declaration = () =>
      f.createVariableDeclarationList(
        [
          f.createVariableDeclaration(
            id("x"),
            undefined,
            undefined,
            inExpression(),
          ),
        ],
        NodeFlags.Let,
      );
    const forCases: Case[] = [
      {
        name: "in as a declaration initializer",
        text: 'for (let x = ("a" in b); ; ) ;',
        tree: () => forInit(declaration()),
        shape: `ForStatement(VariableDeclarationList(VariableDeclaration(Identifier,ParenthesizedExpression(${IN}))),EmptyStatement)`,
      },
      {
        name: "in as an expression initializer",
        text: 'for (("a" in b); ; ) ;',
        tree: () => forInit(inExpression()),
        shape: `ForStatement(ParenthesizedExpression(${IN}),EmptyStatement)`,
      },
      {
        name: "in as an array element",
        text: 'for ((["a" in b]); ; ) ;',
        tree: () => forInit(f.createArrayLiteralExpression([inExpression()])),
        shape: `ForStatement(ParenthesizedExpression(ArrayLiteralExpression(${IN})),EmptyStatement)`,
      },
      {
        name: "in as a member-chain receiver",
        text: 'for (("a" in b).c; ; ) ;',
        tree: () =>
          forInit(f.createPropertyAccessExpression(inExpression(), "c")),
        shape: `ForStatement(PropertyAccessExpression(ParenthesizedExpression(${IN}),Identifier),EmptyStatement)`,
      },
      {
        name: "in as a conditional consequent needs no parentheses",
        text: 'for (v = c ? "a" in b : d; ; ) ;',
        tree: () =>
          forInit(
            f.createBinaryExpression(
              id("v"),
              SyntaxKind.EqualsToken,
              f.createConditionalExpression(
                id("c"),
                undefined,
                inExpression(),
                undefined,
                id("d"),
              ),
            ),
          ),
        shape: `ForStatement(BinaryExpression(Identifier,[=],ConditionalExpression(Identifier,[?],${IN},[:],Identifier)),EmptyStatement)`,
      },
    ];
    const expression = (name: string) => f.createExpressionStatement(id(name));
    const bareIf = () => f.createIfStatement(id("b"), expression("x"));
    const braced = (statement: Node) => f.createBlock([statement as never], true);
    const elseCases: Case[] = [
      {
        name: "then-branch is an if without else",
        elses: [true, false],
        text: "if (a) {\n  if (b) x;\n} else y;",
        tree: () => f.createIfStatement(id("a"), bareIf(), expression("y")),
      },
      {
        name: "then-branch is a block already holding that if",
        elses: [true, false],
        text: "if (a) {\n  if (b) x;\n} else y;",
        tree: () =>
          f.createIfStatement(id("a"), braced(bareIf()), expression("y")),
      },
      {
        name: "then-branch is a while around that if",
        elses: [true, false],
        text: "if (a) {\n  while (w) if (b) x;\n} else y;",
        tree: () =>
          f.createIfStatement(
            id("a"),
            f.createWhileStatement(id("w"), bareIf()),
            expression("y"),
          ),
      },
      {
        name: "then-branch is a for around that if",
        elses: [true, false],
        text: "if (a) {\n  for (; ; ) if (b) x;\n} else y;",
        tree: () =>
          f.createIfStatement(
            id("a"),
            f.createForStatement(undefined, undefined, undefined, bareIf()),
            expression("y"),
          ),
      },
      {
        name: "then-branch is a label around that if",
        elses: [true, false],
        text: "if (a) {\n  L: if (b) x;\n} else y;",
        tree: () =>
          f.createIfStatement(
            id("a"),
            f.createLabeledStatement("L", bareIf()),
            expression("y"),
          ),
      },
      {
        name: "negative: an outer if without else needs no block",
        elses: [false, false],
        text: "if (a) if (b) x;",
        tree: () => f.createIfStatement(id("a"), bareIf()),
      },
      {
        name: "negative: an inner if with its own else needs no block",
        elses: [true, true],
        text: "if (a) if (b) x; else z; else y;",
        tree: () =>
          f.createIfStatement(
            id("a"),
            f.createIfStatement(id("b"), expression("x"), expression("z")),
            expression("y"),
          ),
      },
      {
        name: "negative: a plain statement then-branch needs no block",
        elses: [true, false],
        text: "if (a) x; else y;",
        tree: () =>
          f.createIfStatement(id("a"), expression("x"), expression("y")),
      },
    ];
    const otherCases: Case[] = [
      {
        name: "for-of over a comma list",
        text: "for (x of (a, b)) ;",
        tree: () =>
          f.createForOfStatement(
            undefined,
            id("x"),
            f.createBinaryExpression(id("a"), SyntaxKind.CommaToken, id("b")),
            f.createEmptyStatement(),
          ),
        shape:
          "ForOfStatement(Identifier,ParenthesizedExpression(BinaryExpression(Identifier,[,],Identifier)),EmptyStatement)",
      },
      {
        name: "decorator on an element access",
        text: "@(d[e])\nclass A {}",
        tree: () =>
          f.createClassDeclaration(
            [
              f.createDecorator(f.createElementAccessExpression(id("d"), id("e"))),
            ],
            "A",
            undefined,
            undefined,
            [],
          ),
        shape:
          "ClassDeclaration(Decorator(ParenthesizedExpression(ElementAccessExpression(Identifier,Identifier))),Identifier)",
      },
      {
        name: "a relational chain keeps the parentheses under >",
        text: "(a < b) > c;",
        tree: () =>
          f.createExpressionStatement(
            f.createBinaryExpression(
              f.createBinaryExpression(id("a"), SyntaxKind.LessThanToken, id("b")),
              SyntaxKind.GreaterThanToken,
              id("c"),
            ),
          ),
        shape:
          "ExpressionStatement(BinaryExpression(ParenthesizedExpression(BinaryExpression(Identifier,[<],Identifier)),[>],Identifier))",
      },
    ];

    for (const c of [...forCases, ...elseCases, ...otherCases]) {
      const text: string = print(c.tree());
      TestValidator.equals(c.name, text, c.text);
      const file: ts.SourceFile = parseClean(c.text);
      const statement: ts.Statement = file.statements[0]!;
      if (c.elses !== undefined) {
        const outer = statement as ts.IfStatement;
        const inner = innermostIf(outer.thenStatement);
        TestValidator.equals(
          `${c.name}: the else belongs to the outer if`,
          [outer.elseStatement !== undefined, inner?.elseStatement !== undefined],
          c.elses,
        );
        continue;
      }
      TestValidator.equals(
        `${c.name}: the literal parses to the intended tree`,
        shapeOf(statement),
        c.shape,
      );
    }

    const narrow = new TsPrinter({ printWidth: 20 });
    const wide = new TsPrinter({ printWidth: 80 });
    const chain = (kind: SyntaxKind) =>
      f.createExpressionStatement(
        f.createBinaryExpression(id("a".repeat(12)), kind, id("b".repeat(12))),
      );
    for (const [name, kind, operator] of [
      ["greater-than", SyntaxKind.GreaterThanToken, ">"],
      ["right shift", SyntaxKind.GreaterThanGreaterThanToken, ">>"],
    ] as const)
      TestValidator.equals(
        `${name} never breaks after the operator`,
        narrow.print(chain(kind)),
        `${"a".repeat(12)} ${operator} ${"b".repeat(12)};`,
      );
    for (const [name, kind, operator] of [
      ["less-than", SyntaxKind.LessThanToken, "<"],
      ["unsigned right shift", SyntaxKind.GreaterThanGreaterThanGreaterThanToken, ">>>"],
      ["greater-or-equal", SyntaxKind.GreaterThanEqualsToken, ">="],
    ] as const) {
      TestValidator.equals(
        `${name} breaks after the operator when narrow`,
        narrow.print(chain(kind)),
        `${"a".repeat(12)} ${operator}\n  ${"b".repeat(12)};`,
      );
      TestValidator.equals(
        `${name} stays on one line when wide`,
        wide.print(chain(kind)),
        `${"a".repeat(12)} ${operator} ${"b".repeat(12)};`,
      );
    }
  };
