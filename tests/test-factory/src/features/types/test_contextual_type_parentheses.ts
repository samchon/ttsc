import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { id, print, ref } from "../../internal/helpers";

/**
 * Verifies contextual type parenthesizer: wraps operands before postfix and
 * type operators.
 *
 * Locks the TypeScript parenthesizer rules for type contexts outside bare
 * binary lists. Array, indexed access, tuple optional/rest, and type operators
 * all bind tighter than several type forms and must not steal their operands.
 *
 * 1. Print postfix type operands around union, function, type query, and keyof.
 * 2. Print type-operator operands around unions and nested type operators.
 * 3. Assert parentheses appear only where the context requires them.
 */
export const test_contextual_type_parentheses = (): void => {
  TestValidator.equals(
    "array wraps union",
    print(
      factory.createArrayTypeNode(
        factory.createUnionTypeNode([ref("A"), ref("B")]),
      ),
    ),
    "(A | B)[]",
  );
  TestValidator.equals(
    "indexed access wraps typeof",
    print(
      factory.createIndexedAccessTypeNode(
        factory.createTypeQueryNode(id("value")),
        ref("K"),
      ),
    ),
    "(typeof value)[K]",
  );
  TestValidator.equals(
    "optional tuple wraps function",
    print(
      factory.createTupleTypeNode([
        factory.createOptionalTypeNode(
          factory.createFunctionTypeNode(undefined, [], ref("R")),
        ),
      ]),
    ),
    "[(() => R)?]",
  );
  TestValidator.equals(
    "rest tuple wraps union",
    print(
      factory.createTupleTypeNode([
        factory.createRestTypeNode(
          factory.createUnionTypeNode([ref("A"), ref("B")]),
        ),
      ]),
    ),
    "[...(A | B)]",
  );
  TestValidator.equals(
    "keyof wraps union",
    print(
      factory.createTypeOperatorNode(
        SyntaxKind.KeyOfKeyword,
        factory.createUnionTypeNode([ref("A"), ref("B")]),
      ),
    ),
    "keyof (A | B)",
  );
  TestValidator.equals(
    "readonly wraps nested operator",
    print(
      factory.createTypeOperatorNode(
        SyntaxKind.ReadonlyKeyword,
        factory.createTypeOperatorNode(SyntaxKind.KeyOfKeyword, ref("A")),
      ),
    ),
    "readonly (keyof A)",
  );
};
