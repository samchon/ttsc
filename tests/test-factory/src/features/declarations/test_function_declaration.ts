import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { kw, mod, param, print, ref } from "../../internal/helpers";

/**
 * Print a {@link factory.createFunctionDeclaration|function declaration}.
 *
 * An exported async generic function with a typed parameter, a `Promise<T>`
 * return, and a block body.
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
