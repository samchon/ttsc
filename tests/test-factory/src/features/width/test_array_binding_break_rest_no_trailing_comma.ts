import { TestValidator } from "@nestia/e2e";
import factory, { NodeFlags, SyntaxKind, TsPrinter } from "../../../../../packages/factory/src/index";

import { id } from "../../internal/helpers";

/**
 * Verifies a broken array binding pattern ending in a rest element drops the
 * synthetic trailing comma.
 *
 * Pins `TsPrinter.listTrailingComma` at the `ArrayBindingPattern` call site: a
 * trailing comma after a rest element is a syntax error (TS1013 / V8 "Rest
 * element must be last element"). The non-rest twin in the same pattern shape
 * keeps its trailing comma, so the suppression is provably scoped to the rest
 * case.
 *
 * 1. Print a wider-than-`printWidth` `const [...] = values;` whose last element is
 *    `...rest`.
 * 2. Assert the broken layout carries no comma after the rest element.
 * 3. Print the same pattern with a plain last element; assert its trailing comma
 *    is kept.
 *
 * @evidence contracts/testing.md#behavioral-verification Broken array bindings drop a comma after final rest while the plain final-binding twin keeps it.
 * @evidence contracts/testing.md#independent-expectations Explicit multiline const pattern literals independently encode the JavaScript prohibition on rest trailing commas.
 * @evidence contracts/testing.md#distinguishing-cases Rest true/false at printWidth 20 changes only the final binding form, catching blanket comma suppression.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_array_binding_break_rest_no_trailing_comma. Calls the local declare fixture, TsPrinter.print and exact comparisons for both labeled variants.
 */
export const test_array_binding_break_rest_no_trailing_comma = (): void => {
  const tiny = new TsPrinter({ printWidth: 20 });
  const declare = (rest: boolean) =>
    factory.createVariableStatement(
      undefined,
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            factory.createArrayBindingPattern([
              factory.createBindingElement(undefined, undefined, "first"),
              factory.createBindingElement(undefined, undefined, "second"),
              factory.createBindingElement(
                rest
                  ? factory.createToken(SyntaxKind.DotDotDotToken)
                  : undefined,
                undefined,
                "last",
              ),
            ]),
            undefined,
            undefined,
            id("values"),
          ),
        ],
        NodeFlags.Const,
      ),
    );
  TestValidator.equals(
    "rest last drops trailing comma",
    tiny.print(declare(true)),
    ["const [", "  first,", "  second,", "  ...last", "] = values;"].join("\n"),
  );
  TestValidator.equals(
    "plain last keeps trailing comma",
    tiny.print(declare(false)),
    ["const [", "  first,", "  second,", "  last,", "] = values;"].join("\n"),
  );
};
