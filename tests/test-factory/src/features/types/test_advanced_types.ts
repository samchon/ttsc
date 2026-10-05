import { TestValidator } from "@nestia/e2e";

import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";
import { kw, param, print, ref } from "../../internal/helpers";

/**
 * Verifies printing of the advanced type-system nodes.
 *
 * The `this` type, a conditional type, an `infer` type, an `is` type predicate
 * (plain and `asserts`), a constructor type, and a mapped type with `readonly`
 * / `?` modifiers.
 *
 * 1. This/conditional/infer/predicate/constructor/mapped type nodes retain their
 *    specialized syntax and modifiers.
 * 2. Exact independently authored type literals specify
 *    extends/infer/is/asserts/new and readonly/question mapped markers.
 *
 * @evidence contracts/testing.md#behavioral-verification This/conditional/infer/predicate/constructor/mapped type nodes retain their specialized syntax and modifiers.
 * @evidence contracts/testing.md#independent-expectations Exact independently authored type literals specify extends/infer/is/asserts/new and readonly/question mapped markers.
 * @evidence contracts/testing.md#distinguishing-cases Plain versus asserts predicate and the six different type forms distinguish optional tokens and structural branches.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_advanced_types. Calls the specialized type factory constructors and print in this unit export.
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
