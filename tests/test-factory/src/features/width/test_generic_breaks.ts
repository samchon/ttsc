import { TestValidator } from "@nestia/e2e";

import factory, {
  SyntaxKind,
  TsPrinter,
} from "../../../../../packages/factory/src/index";
import { kw } from "../../internal/helpers";

/**
 * Verifies Generic arguments break when they exceed `printWidth`.
 *
 * `Map<string, number>` breaks under `printWidth: 10` exactly like an argument
 * list would.
 *
 * 1. A width10 Map type argument list breaks without a forbidden trailing
 *    type-argument comma.
 * 2. Explicit Map multiline source independently fixes string/number order and
 *    absent final comma.
 *
 * @evidence contracts/testing.md#behavioral-verification A width10 Map type argument list breaks without a forbidden trailing type-argument comma.
 * @evidence contracts/testing.md#independent-expectations Explicit Map multiline source independently fixes string/number order and absent final comma.
 * @evidence contracts/testing.md#distinguishing-cases Type arguments contrast with value call lists that retain broken-layout trailing commas; flat generic shape is covered by reference_and_array.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_generic_breaks. Calls createTypeReferenceNode and TsPrinter.print with printWidth 10.
 */
export const test_generic_breaks = (): void => {
  const tiny = new TsPrinter({ printWidth: 10 });
  TestValidator.equals(
    "generic break",
    tiny.print(
      factory.createTypeReferenceNode("Map", [
        kw(SyntaxKind.StringKeyword),
        kw(SyntaxKind.NumberKeyword),
      ]),
    ),
    // type-argument lists take no trailing comma (TS1009), unlike value lists
    ["Map<", "  string,", "  number", ">"].join("\n"),
  );
};
