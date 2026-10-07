import { TestValidator } from "@nestia/e2e";

import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";
import { id, kw, param, print, ref } from "../../internal/helpers";

/**
 * Verifies printing of the remaining structural type nodes.
 *
 * Function type, tuple, `keyof`, `readonly T[]`, `unique symbol`, indexed
 * access `T[K]`, `typeof value`, and a parenthesized union.
 *
 * 1. Function, tuple, type operators, indexed access, type query and parenthesized
 *    union preserve their specialized type forms.
 * 2. Each literal type expectation independently fixes arrow, brackets, operators
 *    and query spelling.
 *
 * @evidence contracts/testing.md#behavioral-verification Function, tuple, type operators, indexed access, type query and parenthesized union preserve their specialized type forms.
 * @evidence contracts/testing.md#independent-expectations Each literal type expectation independently fixes arrow, brackets, operators and query spelling.
 * @evidence contracts/testing.md#distinguishing-cases Keyof/readonly/unique operators, tuple versus array and explicit grouped union distinguish structurally different types.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_structural_types. Calls structural type constructors and print; precedence-intensive variants belong to contextual_type_parentheses.
 */
export const test_structural_types = (): void => {
  TestValidator.equals(
    "function",
    print(
      factory.createFunctionTypeNode(
        undefined,
        [param("a", kw(SyntaxKind.NumberKeyword))],
        kw(SyntaxKind.VoidKeyword),
      ),
    ),
    "(a: number) => void",
  );
  TestValidator.equals(
    "tuple",
    print(
      factory.createTupleTypeNode([
        kw(SyntaxKind.NumberKeyword),
        kw(SyntaxKind.StringKeyword),
      ]),
    ),
    "[number, string]",
  );
  TestValidator.equals(
    "keyof",
    print(factory.createTypeOperatorNode(SyntaxKind.KeyOfKeyword, ref("T"))),
    "keyof T",
  );
  TestValidator.equals(
    "readonly",
    print(
      factory.createTypeOperatorNode(
        SyntaxKind.ReadonlyKeyword,
        factory.createArrayTypeNode(ref("T")),
      ),
    ),
    "readonly T[]",
  );
  TestValidator.equals(
    "unique",
    print(
      factory.createTypeOperatorNode(
        SyntaxKind.UniqueKeyword,
        kw(SyntaxKind.SymbolKeyword),
      ),
    ),
    "unique symbol",
  );
  TestValidator.equals(
    "indexed",
    print(factory.createIndexedAccessTypeNode(ref("T"), ref("K"))),
    "T[K]",
  );
  TestValidator.equals(
    "query",
    print(factory.createTypeQueryNode(id("value"))),
    "typeof value",
  );
  TestValidator.equals(
    "paren",
    print(
      factory.createParenthesizedType(
        factory.createUnionTypeNode([ref("A"), ref("B")]),
      ),
    ),
    "(A | B)",
  );
};
