import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { id, kw, param, print, ref } from "../../internal/helpers";

/**
 * Print the remaining structural type nodes.
 *
 * Function type, tuple, `keyof`, `readonly T[]`, `unique symbol`, indexed
 * access `T[K]`, `typeof value`, and a parenthesized union.
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
