import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind, TsPrinter } from "@ttsc/factory";

import { param, ref } from "../../internal/helpers";

/**
 * Verifies a broken parameter list ending in a rest parameter drops the
 * synthetic trailing comma.
 *
 * Pins `TsPrinter.listTrailingComma` at the `params()` call site: a trailing
 * comma after a rest parameter is a syntax error (TS1013 / V8 "Rest parameter
 * must be last formal parameter"), so the width-break comma must be suppressed
 * for rest-terminated signatures. The negative twin — the same shape whose last
 * parameter is not a rest — must keep the trailing comma, so an
 * over-suppression cannot hide here.
 *
 * 1. Print a wider-than-`printWidth` function whose last parameter is `...rest`.
 * 2. Assert the broken layout carries no comma after the rest parameter.
 * 3. Print the same signature with a plain last parameter; assert its trailing
 *    comma is kept.
 * 4. Print a signature whose only parameter is the rest; assert the broken
 *    single-element layout drops the comma too.
 */
export const test_params_break_rest_no_trailing_comma = (): void => {
  const tiny = new TsPrinter({ printWidth: 20 });
  const declare = (rest: boolean) =>
    factory.createFunctionDeclaration(
      undefined,
      undefined,
      "assemble",
      undefined,
      [
        param("first", ref("First")),
        param("second", ref("Second")),
        factory.createParameterDeclaration(
          undefined,
          rest ? factory.createToken(SyntaxKind.DotDotDotToken) : undefined,
          "last",
          undefined,
          factory.createArrayTypeNode(ref("Last")),
          undefined,
        ),
      ],
      undefined,
      factory.createBlock([], false),
    );
  TestValidator.equals(
    "rest last drops trailing comma",
    tiny.print(declare(true)),
    [
      "function assemble(",
      "  first: First,",
      "  second: Second,",
      "  ...last: Last[]",
      ") {}",
    ].join("\n"),
  );
  TestValidator.equals(
    "plain last keeps trailing comma",
    tiny.print(declare(false)),
    [
      "function assemble(",
      "  first: First,",
      "  second: Second,",
      "  last: Last[],",
      ") {}",
    ].join("\n"),
  );
  TestValidator.equals(
    "only-rest single element drops trailing comma",
    tiny.print(
      factory.createFunctionDeclaration(
        undefined,
        undefined,
        "gather",
        undefined,
        [
          factory.createParameterDeclaration(
            undefined,
            factory.createToken(SyntaxKind.DotDotDotToken),
            "everything",
            undefined,
            factory.createArrayTypeNode(ref("Item")),
            undefined,
          ),
        ],
        undefined,
        factory.createBlock([], false),
      ),
    ),
    ["function gather(", "  ...everything: Item[]", ") {}"].join("\n"),
  );
};
