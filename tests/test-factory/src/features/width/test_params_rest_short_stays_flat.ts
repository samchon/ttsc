import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { param, print, ref } from "../../internal/helpers";

/**
 * Verifies a short rest-terminated signature stays on one line, byte-identical
 * to the pre-suppression output.
 *
 * Boundary twin of the rest trailing-comma suppression: when the list fits
 * within `printWidth`, `delim` never emits the `ifBreak` comma, so computing
 * `trailingComma` from the last element must not perturb the flat layout in any
 * way.
 *
 * 1. Print `function f(a: A, ...rest: B[]) {}` with the default 80-column printer.
 * 2. Assert the output is the exact single-line text.
 */
export const test_params_rest_short_stays_flat = (): void => {
  TestValidator.equals(
    "short rest signature stays flat",
    print(
      factory.createFunctionDeclaration(
        undefined,
        undefined,
        "f",
        undefined,
        [
          param("a", ref("A")),
          factory.createParameterDeclaration(
            undefined,
            factory.createToken(SyntaxKind.DotDotDotToken),
            "rest",
            undefined,
            factory.createArrayTypeNode(ref("B")),
            undefined,
          ),
        ],
        undefined,
        factory.createBlock([], false),
      ),
    ),
    "function f(a: A, ...rest: B[]) {}",
  );
};
