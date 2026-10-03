import { TestValidator } from "@nestia/e2e";
import ts from "ts-legacy";

import factory, {
  type Node,
  SyntaxKind,
} from "../../../../../packages/factory/src/index";
import { id, print } from "../../internal/helpers";
import { parseClean, shapeOf } from "../../internal/oracle";

const f = factory;

/** One tree with the text it must print as and the tree that text must parse to. */
interface Case {
  name: string;
  text: string;
  tree: () => Node;
  shape: string;
}

const less = (left: string, right: string) =>
  f.createBinaryExpression(id(left), SyntaxKind.LessThanToken, id(right));
const greater = (left: string, right: string) =>
  f.createBinaryExpression(
    id(left),
    SyntaxKind.GreaterThanToken,
    f.createParenthesizedExpression(id(right)),
  );
const statement = (expression: ts.Expression | Node) =>
  f.createExpressionStatement(expression as never);
const LT = "BinaryExpression(Identifier,[<],Identifier)";
const GT_PAREN = "BinaryExpression(Identifier,[>],ParenthesizedExpression(Identifier))";

/**
 * Verifies the printer parenthesizes a `<` comparison exactly where the text
 * would otherwise be read as type arguments of a call, and leaves the same
 * comparison bare elsewhere.
 *
 * TypeScript reads `a < b ... > (` as a generic call when a later `>` is followed
 * by `(`, a template or a line break, so a comparison whose closing `>` sits
 * after it in the same expression list or operand chain must be parenthesized,
 * or must have its right operand prefixed with a value-neutral `+0 as number,`
 * sequence (the cast keeps the checker from reporting a side-effect-free comma
 * operand) when the `>` belongs to that operand. An arrow consequent whose body is a
 * parenthesized object is parenthesized so it is not read as a nested arrow head.
 *
 * 1. Print the pair `a < b` and `c > (d)` as a call argument list, an array, a
 *    comma list, a bitwise operand and a binary operand, and parse each text.
 * 2. Print the neighbors where no later `>` is followed by `(`: a plain right
 *    operand, a call with plain arguments and a logical chain.
 * 3. Print a `<` or `<<` whose right operand holds the closing `>`, and the arrow
 *    consequent.
 * 4. Compare each text with an authored literal and the legacy parse of that
 *    literal with an authored kind outline.
 *
 * @evidence contracts/testing.md#behavioral-verification Prints each tree with TsPrinter and requires the exact authored text, then parses the text with the pinned legacy parser and requires a clean parse whose outline shows a comparison and no call or type-argument node where the tree had none.
 * @evidence contracts/testing.md#independent-expectations The literals follow the TypeScript parser's rule for reading `<` as type arguments (a later `>` followed by `(`, a template or a line break) and ECMAScript operator precedence; the expectation is the legacy parse of the authored text compared with an authored kind outline, not the printer's own output. The `+0 as number,` prefix is a value-neutral comma operand and appears in the outline.
 * @evidence contracts/testing.md#distinguishing-cases The comparison before `c > (d)` is parenthesized in an argument list, array, comma list and bitwise operand, while a plain right operand, plain call arguments and a logical chain print bare; a `<` and a `<<` whose right operand holds the closing `>` take the `+0 as number,` wrapper; the arrow consequent differs from a plain consequent only in its parenthesized body.
 * @evidence contracts/testing.md#execution-ownership Factory unit entry that builds nodes with the factories and prints them in process; the legacy parser is only the grammar reference and no compiler or process runs. Line-breaking of `>` and `>>` is owned by test_printer_parenthesizes_in_else_for_of_and_decorator_hazards.
 */
export const test_printer_keeps_less_than_comparisons_from_reading_as_type_arguments =
  (): void => {
    const cases: Case[] = [
      {
        name: "a parenthesized right operand makes the comparison parenthesized",
        text: "(a < b) > (c);",
        tree: () =>
          statement(
            f.createBinaryExpression(
              less("a", "b"),
              SyntaxKind.GreaterThanToken,
              f.createParenthesizedExpression(id("c")),
            ),
          ),
        shape: `ExpressionStatement(BinaryExpression(ParenthesizedExpression(${LT}),[>],ParenthesizedExpression(Identifier)))`,
      },
      {
        name: "negative: a plain right operand keeps the comparison bare",
        text: "a < b > c;",
        tree: () =>
          statement(
            f.createBinaryExpression(
              less("a", "b"),
              SyntaxKind.GreaterThanToken,
              id("c"),
            ),
          ),
        shape: `ExpressionStatement(BinaryExpression(${LT},[>],Identifier))`,
      },
      {
        name: "comparison before a parenthesized greater-than in call arguments",
        text: "f((a < b), c > (d));",
        tree: () =>
          statement(
            f.createCallExpression(id("f"), undefined, [
              less("a", "b"),
              greater("c", "d"),
            ]),
          ),
        shape: `ExpressionStatement(CallExpression(Identifier,ParenthesizedExpression(${LT}),${GT_PAREN}))`,
      },
      {
        name: "negative: plain call arguments need no parentheses",
        text: "f(a < b, c > d);",
        tree: () =>
          statement(
            f.createCallExpression(id("f"), undefined, [
              less("a", "b"),
              f.createBinaryExpression(
                id("c"),
                SyntaxKind.GreaterThanToken,
                id("d"),
              ),
            ]),
          ),
        shape: `ExpressionStatement(CallExpression(Identifier,${LT},BinaryExpression(Identifier,[>],Identifier)))`,
      },
      {
        name: "comparison as a bitwise-or operand",
        text: "(a < b) | c > (d);",
        tree: () =>
          statement(
            f.createBinaryExpression(
              less("a", "b"),
              SyntaxKind.BarToken,
              greater("c", "d"),
            ),
          ),
        shape: `ExpressionStatement(BinaryExpression(ParenthesizedExpression(${LT}),[|],${GT_PAREN}))`,
      },
      {
        name: "comparison as an array element",
        text: "[(a < b), c > (d)];",
        tree: () =>
          statement(
            f.createArrayLiteralExpression([less("a", "b"), greater("c", "d")]),
          ),
        shape: `ExpressionStatement(ArrayLiteralExpression(ParenthesizedExpression(${LT}),${GT_PAREN}))`,
      },
      {
        name: "comparison in a comma list",
        text: "(a < b), c > (d);",
        tree: () =>
          statement(
            f.createBinaryExpression(
              less("a", "b"),
              SyntaxKind.CommaToken,
              greater("c", "d"),
            ),
          ),
        shape: `ExpressionStatement(BinaryExpression(ParenthesizedExpression(${LT}),[,],${GT_PAREN}))`,
      },
      {
        name: "negative: a logical chain needs no parentheses",
        text: "i < n && x > (y);",
        tree: () =>
          statement(
            f.createBinaryExpression(
              less("i", "n"),
              SyntaxKind.AmpersandAmpersandToken,
              greater("x", "y"),
            ),
          ),
        shape: `ExpressionStatement(BinaryExpression(${LT},[&&],${GT_PAREN}))`,
      },
      {
        name: "less-than whose right operand holds the closing greater-than",
        text: "a < (+0 as number, c > (a));",
        tree: () =>
          statement(
            f.createBinaryExpression(
              id("a"),
              SyntaxKind.LessThanToken,
              greater("c", "a"),
            ),
          ),
        shape: `ExpressionStatement(BinaryExpression(Identifier,[<],ParenthesizedExpression(BinaryExpression(AsExpression(PrefixUnaryExpression(NumericLiteral),NumberKeyword),[,],${GT_PAREN}))))`,
      },
      {
        name: "shift whose right operand holds a greater-than before a template",
        text: "a << (+0 as number, c > `t`);",
        tree: () =>
          statement(
            f.createBinaryExpression(
              id("a"),
              SyntaxKind.LessThanLessThanToken,
              f.createBinaryExpression(
                id("c"),
                SyntaxKind.GreaterThanToken,
                f.createNoSubstitutionTemplateLiteral("t"),
              ),
            ),
          ),
        shape:
          "ExpressionStatement(BinaryExpression(Identifier,[<<],ParenthesizedExpression(BinaryExpression(AsExpression(PrefixUnaryExpression(NumericLiteral),NumberKeyword),[,],BinaryExpression(Identifier,[>],FirstTemplateToken)))))",
      },
      {
        name: "arrow consequent with a parenthesized object body",
        text: "a ? (() => ({})) : c;",
        tree: () =>
          statement(
            f.createConditionalExpression(
              id("a"),
              undefined,
              f.createArrowFunction(
                undefined,
                undefined,
                [],
                undefined,
                undefined,
                f.createParenthesizedExpression(
                  f.createObjectLiteralExpression([]),
                ),
              ),
              undefined,
              id("c"),
            ),
          ),
        shape:
          "ExpressionStatement(ConditionalExpression(Identifier,[?],ParenthesizedExpression(ArrowFunction([=>],ParenthesizedExpression(ObjectLiteralExpression))),[:],Identifier))",
      },
    ];

    for (const c of cases) {
      TestValidator.equals(c.name, print(c.tree()), c.text);
      TestValidator.equals(
        `${c.name}: the literal parses to the intended tree`,
        shapeOf(parseClean(c.text).statements[0]!),
        c.shape,
      );
    }
  };
