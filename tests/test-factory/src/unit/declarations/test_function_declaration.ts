import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";

import { kw, mod, param, print, ref } from "../../internal/helpers";

/**
 * Verifies printing of a {@link factory.createFunctionDeclaration|function declaration}.
 *
 * An exported async generic function with a typed parameter, a `Promise<T>`
 * return, and a block body.
 *
 * 1. The exported async generic load function preserves its typed parameter, Promise<T> result and return-null block.
 * 2. The explicit multiline load<T> source fixes modifier order, generic punctuation, return value and indentation.
 *
 * @evidence contracts/testing.md#behavioral-verification The exported async generic load function preserves its typed parameter, Promise<T> result and return-null block.
 * @evidence contracts/testing.md#independent-expectations The explicit multiline load<T> source fixes modifier order, generic punctuation, return value and indentation.
 * @evidence contracts/testing.md#distinguishing-cases Named body-bearing generic declaration complements anonymous/generator function_expression and parameter_variants.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_function_declaration. Calls createFunctionDeclaration with authored parameter/type/body nodes and TsPrinter.print directly.
 */
export const test_function_declaration = (): void => {
  TestValidator.equals(
    "function",
    print(
      factory.createFunctionDeclaration(
        [mod(SyntaxKind.ExportKeyword), mod(SyntaxKind.AsyncKeyword)],
        undefined,
        "load",
        [factory.createTypeParameterDeclaration(undefined, "T")],
        [param("id", kw(SyntaxKind.StringKeyword))],
        factory.createTypeReferenceNode("Promise", [ref("T")]),
        factory.createBlock(
          [factory.createReturnStatement(factory.createNull())],
          true,
        ),
      ),
    ),
    [
      "export async function load<T>(id: string): Promise<T> {",
      "  return null;",
      "}",
    ].join("\n"),
  );
};
