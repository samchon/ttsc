import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { kw, param, print, ref } from "../../internal/helpers";

/**
 * Print the advanced type-system nodes.
 *
 * The `this` type, a conditional type, an `infer` type, a `typeof`-style type
 * predicate (plain and `asserts`), a constructor type, and a mapped type with
 * `readonly` / `?` modifiers.
 */
export const test_advanced_types = (): void => {
  TestValidator.equals("this", print(factory.createThisTypeNode()), "this");
  TestValidator.equals(
    "conditional",
    print(
      factory.createConditionalTypeNode(ref("T"), ref("U"), ref("X"), ref("Y")),
    ),
    "T extends U ? X : Y",
  );
  TestValidator.equals(
    "infer",
    print(
      factory.createInferTypeNode(
        factory.createTypeParameterDeclaration(undefined, "R"),
      ),
    ),
    "infer R",
  );
  TestValidator.equals(
    "predicate",
    print(factory.createTypePredicateNode(undefined, "x", ref("T"))),
    "x is T",
  );
  TestValidator.equals(
    "asserts predicate",
    print(
      factory.createTypePredicateNode(
        factory.createToken(SyntaxKind.AssertsKeyword),
        "x",
        ref("T"),
      ),
    ),
    "asserts x is T",
  );
  TestValidator.equals(
    "constructor type",
    print(
      factory.createConstructorTypeNode(
        undefined,
        undefined,
        [param("a", kw(SyntaxKind.NumberKeyword))],
        ref("T"),
      ),
    ),
    "new (a: number) => T",
  );
  TestValidator.equals(
    "mapped",
    print(
      factory.createMappedTypeNode(
        factory.createToken(SyntaxKind.ReadonlyKeyword),
        factory.createTypeParameterDeclaration(undefined, "K", ref("Keys")),
        undefined,
        factory.createToken(SyntaxKind.QuestionToken),
        kw(SyntaxKind.StringKeyword),
        undefined,
      ),
    ),
    "{ readonly [K in Keys]?: string }",
  );
};
