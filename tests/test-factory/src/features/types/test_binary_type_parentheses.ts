import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind, TsPrinter } from "@ttsc/factory";

import { kw, print, ref } from "../../internal/helpers";

/**
 * Verifies type binary parenthesizer: flattens same operators and wraps lower
 * precedence.
 *
 * Locks the `TsPrinter` union/intersection operand rules. Nested same-kind
 * nodes must flatten so broken layouts do not emit a dangling operator, while
 * lower-precedence or non-associative operands keep parentheses.
 *
 * 1. Print nested union and intersection operands, including a forced break.
 * 2. Print union-in-intersection and intersection-in-union operands.
 * 3. Assert the emitted source preserves the requested type tree.
 */
export const test_binary_type_parentheses = (): void => {
  TestValidator.equals(
    "nested union flattens",
    print(
      factory.createUnionTypeNode([
        factory.createUnionTypeNode([ref("A"), ref("B")]),
        ref("C"),
      ]),
    ),
    "A | B | C",
  );
  TestValidator.equals(
    "nested intersection flattens",
    print(
      factory.createIntersectionTypeNode([
        factory.createIntersectionTypeNode([ref("A"), ref("B")]),
        ref("C"),
      ]),
    ),
    "A & B & C",
  );
  TestValidator.equals(
    "intersection wraps union",
    print(
      factory.createIntersectionTypeNode([
        kw(SyntaxKind.StringKeyword),
        factory.createUnionTypeNode([
          kw(SyntaxKind.NumberKeyword),
          kw(SyntaxKind.BooleanKeyword),
        ]),
      ]),
    ),
    "string & (number | boolean)",
  );
  TestValidator.equals(
    "union wraps intersection",
    print(
      factory.createUnionTypeNode([
        factory.createIntersectionTypeNode([ref("A"), ref("B")]),
        ref("C"),
      ]),
    ),
    "(A & B) | C",
  );

  const narrow = new TsPrinter({ printWidth: 40 });
  TestValidator.equals(
    "forced intersection break has no dangling ampersand",
    narrow.print(
      factory.createTypeAliasDeclaration(
        undefined,
        "Tags",
        undefined,
        factory.createIntersectionTypeNode([
          factory.createIntersectionTypeNode([
            kw(SyntaxKind.StringKeyword),
            ref("SomeVeryLongTagReferenceNameThatForcesTheLayoutToBreak"),
          ]),
          ref("MinLength"),
        ]),
      ),
    ),
    [
      "type Tags =",
      "  & string",
      "  & SomeVeryLongTagReferenceNameThatForcesTheLayoutToBreak",
      "  & MinLength;",
    ].join("\n"),
  );
};
