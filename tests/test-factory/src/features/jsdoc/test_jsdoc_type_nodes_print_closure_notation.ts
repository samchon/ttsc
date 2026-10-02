import { TestValidator } from "@nestia/e2e";

import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";
import { kw, print, ref } from "../../internal/helpers";

/**
 * Verifies the JSDoc-only type nodes print Closure notation, including the
 * prefix and postfix forms of nullable and non-nullable types.
 *
 * Closure types are written `*`, `?`, `?T`, `T?`, `!T`, `T!`, `T=` and `...T`.
 * The prefix or postfix position is a caller choice recorded on the node, so the
 * same operand prints on either side of the marker.
 *
 * 1. Print the all and unknown types.
 * 2. Print nullable and non-nullable types in prefix and postfix position.
 * 3. Print optional, variadic, namepath, function and type-expression nodes.
 *
 * @evidence contracts/testing.md#behavioral-verification Prints each JSDoc type builder and compares the text with an authored literal.
 * @evidence contracts/testing.md#independent-expectations Authored literals follow the documented Closure-style notation (`?string`, `string?`, `string=`, `...string`, `{string}`); no differential printer expectation is used.
 * @evidence contracts/testing.md#distinguishing-cases Prefix and postfix positions contrast for both nullable kinds; a typed function with a return contrasts with an empty function without a return and the bare name path.
 * @evidence contracts/testing.md#execution-ownership Factory unit entry calling the builders and TsPrinter.print in process. Tag printing is owned by the test_jsdoc_tags_* entries.
 */
export const test_jsdoc_type_nodes_print_closure_notation = (): void => {
  const string = () => kw(SyntaxKind.StringKeyword);
  TestValidator.equals("all", print(factory.createJSDocAllType()), "*");
  TestValidator.equals("unknown", print(factory.createJSDocUnknownType()), "?");
  TestValidator.equals(
    "nullable prefix",
    print(factory.createJSDocNullableType(string())),
    "?string",
  );
  TestValidator.equals(
    "nullable postfix",
    print(factory.createJSDocNullableType(string(), true)),
    "string?",
  );
  TestValidator.equals(
    "non-nullable prefix",
    print(factory.createJSDocNonNullableType(string())),
    "!string",
  );
  TestValidator.equals(
    "non-nullable postfix",
    print(factory.createJSDocNonNullableType(string(), true)),
    "string!",
  );
  TestValidator.equals(
    "optional",
    print(factory.createJSDocOptionalType(string())),
    "string=",
  );
  TestValidator.equals(
    "variadic",
    print(factory.createJSDocVariadicType(string())),
    "...string",
  );
  TestValidator.equals(
    "namepath",
    print(factory.createJSDocNamepathType(ref("A"))),
    "A",
  );
  TestValidator.equals(
    "function type",
    print(
      factory.createJSDocFunctionType(
        [
          factory.createParameterDeclaration(
            undefined,
            undefined,
            "a",
            undefined,
            string(),
          ),
        ],
        string(),
      ),
    ),
    "function(a: string): string",
  );
  TestValidator.equals(
    "function without a return type",
    print(factory.createJSDocFunctionType([], undefined)),
    "function()",
  );
  TestValidator.equals(
    "type expression",
    print(factory.createJSDocTypeExpression(string())),
    "{string}",
  );
};
