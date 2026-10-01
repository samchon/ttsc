import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";

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
 * 3. Assert each of the six operands is printed inside the parentheses shown in
 *    the expected text; no unwrapped negative twin is executed here.
 *
 * @evidence contracts/testing.md#behavioral-verification Postfix array/index/tuple operators and keyof/readonly wrappers preserve their lower-binding operands.
 * @evidence contracts/testing.md#independent-expectations Explicit parenthesized type sources independently establish which postfix or prefix operator owns each operand.
 * @evidence contracts/testing.md#distinguishing-cases Six rows pair a wrapped operand (union, type query, function, union, union, nested keyof) with its own consumer (array, indexed access, optional tuple element, rest tuple element, keyof, readonly); every row is a case where parentheses are required, so over-wrapping of bare operands is not detected by this test.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_contextual_type_parentheses. Calls the labeled type constructors and TsPrinter.print directly.
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
