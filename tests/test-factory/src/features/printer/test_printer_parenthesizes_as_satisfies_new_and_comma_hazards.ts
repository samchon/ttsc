import { TestValidator } from "@nestia/e2e";
import ts from "ts-legacy";

import factory, {
  type Node,
  SyntaxKind,
} from "../../../../../packages/factory/src/index";
import { id, print } from "../../internal/helpers";
import { parseClean, printLegacy, structure } from "../../internal/oracle";

const f = factory;
const l = ts.factory;
const lid = (text: string) => l.createIdentifier(text);
const type = (text: string) => f.createTypeReferenceNode(text);
const ltype = (text: string) => l.createTypeReferenceNode(text, undefined);

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
    punctuation !== undefined
      ? `[${punctuation}]`
      : ts.isNumericLiteral(node)
        ? "NumericLiteral"
        : ts.SyntaxKind[node.kind]!;
  return children.length === 0 ? name : `${name}(${children.join(",")})`;
};

/** One tree built for each printer, with the text it must print as. */
interface Case {
  name: string;
  text: string;
  ttsc: () => Node;
  /**
   * The legacy tree for the differential comparison, given only where the legacy
   * printer prints the grammar-correct text; `shape` is the outline of the
   * authored literal's legacy parse otherwise.
   */
  legacy?: () => ts.Node;
  shape?: string;
}

/**
 * Verifies the printer keeps the parentheses that a `new` target, an `as` or
 * `satisfies` operand and a leading object literal need to re-parse as the tree.
 *
 * `as` and `satisfies` bind like a relational operator and take a type on their
 * right, so a following `&`, `|` or `<` would be read as part of that type or as
 * a generic list, and a `?` would make the type conditional. A `new` target
 * ending its leftmost operand in `new X()` would absorb the argument list, and a
 * statement beginning with `{` is a block.
 *
 * 1. Print `new` targets wrapping a `new X()` leftmost in `|` and `satisfies`.
 * 2. Print `as` and `satisfies` operands, and an operand ending in `as`, to the
 *    left of `&`, `|`, `<` and a conditional's `?`.
 * 3. Print a statement whose comma list begins with an object literal.
 * 4. Compare each text with an authored literal, require the literal to parse
 *    cleanly, and compare its legacy parse with an authored kind outline of the
 *    intended tree. The four negatives are also compared with the pinned legacy
 *    printer's output.
 *
 * @evidence contracts/testing.md#behavioral-verification Prints each hazard tree with TsPrinter and requires the exact authored text, so a dropped pair of parentheses or an added one fails the string comparison.
 * @evidence contracts/testing.md#independent-expectations The literals follow the ECMAScript and TypeScript grammars (`as T & y` parses the intersection as the type, `new X()(...)` binds the arguments to the inner construction, `{` at statement start opens a block). Each literal is parsed by the pinned legacy parser and its tree is compared with an authored kind outline, so the oracle is the grammar and not this printer's text. The legacy printer is not the oracle for the hazards because it prints `new new A() | B(x)` and `x as T & y`, which re-parse as other trees; it is the oracle only for the four negatives.
 * @evidence contracts/testing.md#distinguishing-cases A `new` target, an as/satisfies operand before `&`, `|` and `<`, an operand that ends in an `as`, a conditional condition ending in `as` and an object-literal comma head are contrasted with four negatives that must print without parentheses (a bare as, a plain new target, a comma list headed by an identifier and a conditional with a plain condition).
 * @evidence contracts/testing.md#execution-ownership Factory unit entry that builds nodes with the factories and prints them in process; the legacy printer is called only as the differential reference. Width and parenthesizer matrices are owned by the sibling printer and parity entries.
 */
export const test_printer_parenthesizes_as_satisfies_new_and_comma_hazards =
  (): void => {
    const cases: Case[] = [
      {
        name: "new target whose leftmost is new X() inside |",
        text: "new (new A() | B)(x)",
        ttsc: () =>
          f.createNewExpression(
            f.createBinaryExpression(
              f.createNewExpression(id("A"), undefined, []),
              SyntaxKind.BarToken,
              id("B"),
            ),
            undefined,
            [id("x")],
          ),
        shape: "NewExpression(ParenthesizedExpression(BinaryExpression(NewExpression(Identifier),[|],Identifier)),Identifier)",
      },
      {
        name: "new target whose leftmost is new X() under satisfies",
        text: "new (new C() satisfies any)()",
        ttsc: () =>
          f.createNewExpression(
            f.createSatisfiesExpression(
              f.createNewExpression(id("C"), undefined, []),
              type("any"),
            ),
            undefined,
            [],
          ),
        shape: "NewExpression(ParenthesizedExpression(SatisfiesExpression(NewExpression(Identifier),AnyKeyword)))",
      },
      {
        name: "as before &",
        text: "(x as T) & y",
        ttsc: () =>
          f.createBinaryExpression(
            f.createAsExpression(id("x"), type("T")),
            SyntaxKind.AmpersandToken,
            id("y"),
          ),
        shape: "BinaryExpression(ParenthesizedExpression(AsExpression(Identifier,TypeReference(Identifier))),[&],Identifier)",
      },
      {
        name: "as before <",
        text: "(x as T) < y",
        ttsc: () =>
          f.createBinaryExpression(
            f.createAsExpression(id("x"), type("T")),
            SyntaxKind.LessThanToken,
            id("y"),
          ),
        shape: "BinaryExpression(ParenthesizedExpression(AsExpression(Identifier,TypeReference(Identifier))),[<],Identifier)",
      },
      {
        name: "satisfies before |",
        text: "(x satisfies T) | y",
        ttsc: () =>
          f.createBinaryExpression(
            f.createSatisfiesExpression(id("x"), type("T")),
            SyntaxKind.BarToken,
            id("y"),
          ),
        shape: "BinaryExpression(ParenthesizedExpression(SatisfiesExpression(Identifier,TypeReference(Identifier))),[|],Identifier)",
      },
      {
        name: "operand ending in as before &",
        text: "a + (x as T) & y",
        ttsc: () =>
          f.createBinaryExpression(
            f.createBinaryExpression(
              id("a"),
              SyntaxKind.PlusToken,
              f.createAsExpression(id("x"), type("T")),
            ),
            SyntaxKind.AmpersandToken,
            id("y"),
          ),
        shape: "BinaryExpression(BinaryExpression(Identifier,[+],ParenthesizedExpression(AsExpression(Identifier,TypeReference(Identifier)))),[&],Identifier)",
      },
      {
        name: "conditional condition ending in as",
        text: "(x as T) ? -y : z",
        ttsc: () =>
          f.createConditionalExpression(
            f.createAsExpression(id("x"), type("T")),
            undefined,
            f.createPrefixUnaryExpression(SyntaxKind.MinusToken, id("y")),
            undefined,
            id("z"),
          ),
        shape: "ConditionalExpression(ParenthesizedExpression(AsExpression(Identifier,TypeReference(Identifier))),[?],PrefixUnaryExpression(Identifier),[:],Identifier)",
      },
      {
        name: "statement comma list headed by an object literal",
        text: "({ k: 1 }, a);",
        ttsc: () =>
          f.createExpressionStatement(
            f.createBinaryExpression(
              f.createObjectLiteralExpression([
                f.createPropertyAssignment("k", f.createNumericLiteral("1")),
              ]),
              SyntaxKind.CommaToken,
              id("a"),
            ),
          ),
        shape: "ParenthesizedExpression(BinaryExpression(ObjectLiteralExpression(PropertyAssignment(Identifier,NumericLiteral)),[,],Identifier))",
      },
      {
        name: "negative: as alone needs no parentheses",
        text: "x as T",
        ttsc: () => f.createAsExpression(id("x"), type("T")),
        legacy: () => l.createAsExpression(lid("x"), ltype("T")),
      },
      {
        name: "negative: a plain new target needs no parentheses",
        text: "new A(x)",
        ttsc: () => f.createNewExpression(id("A"), undefined, [id("x")]),
        legacy: () => l.createNewExpression(lid("A"), undefined, [lid("x")]),
      },
      {
        name: "negative: a comma list not headed by an object literal",
        text: "a, b;",
        ttsc: () =>
          f.createExpressionStatement(
            f.createBinaryExpression(id("a"), SyntaxKind.CommaToken, id("b")),
          ),
        legacy: () =>
          l.createExpressionStatement(
            l.createBinaryExpression(
              lid("a"),
              ts.SyntaxKind.CommaToken,
              lid("b"),
            ),
          ),
      },
      {
        name: "negative: a conditional condition that is not an as expression",
        text: "c ? -y : z",
        ttsc: () =>
          f.createConditionalExpression(
            id("c"),
            undefined,
            f.createPrefixUnaryExpression(SyntaxKind.MinusToken, id("y")),
            undefined,
            id("z"),
          ),
        legacy: () =>
          l.createConditionalExpression(
            lid("c"),
            undefined,
            l.createPrefixUnaryExpression(ts.SyntaxKind.MinusToken, lid("y")),
            undefined,
            lid("z"),
          ),
      },
    ];

    for (const c of cases) {
      const text: string = print(c.ttsc());
      TestValidator.equals(c.name, text, c.text);
      parseClean(c.text);
      if (c.legacy !== undefined)
        TestValidator.equals(
          `${c.name}: syntax matches the legacy printer`,
          structure(text),
          structure(printLegacy(c.legacy())),
        );
      if (c.shape !== undefined)
        TestValidator.equals(
          `${c.name}: the literal parses to the intended tree`,
          shapeOf(parseClean(c.text).statements[0]!),
          `ExpressionStatement(${c.shape})`,
        );
    }
  };
