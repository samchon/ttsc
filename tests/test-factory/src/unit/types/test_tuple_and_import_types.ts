import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";

import { kw, print, ref, str } from "../../internal/helpers";

/**
 * Verifies printing of named / optional / rest tuple members and import types.
 *
 * A labeled tuple `[first: string, ...rest: number[]]`, optional `[string?]`,
 * rest `[...number[]]`, an `import("mod").Foo<T>` type, and a `typeof import`.
 *
 * 1. Named/optional/rest tuple members and qualified/generic or typeof import types retain each token distinction.
 * 2. Explicit tuple/import source literals independently fix labels, spread/question markers, qualifier and typeof prefix.
 *
 * @evidence contracts/testing.md#behavioral-verification Named/optional/rest tuple members and qualified/generic or typeof import types retain each token distinction.
 * @evidence contracts/testing.md#independent-expectations Explicit tuple/import source literals independently fix labels, spread/question markers, qualifier and typeof prefix.
 * @evidence contracts/testing.md#distinguishing-cases Named rest versus optional/rest standalone elements and value-type versus typeof import distinguish multiple optional fields.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_tuple_and_import_types. Calls tuple/member/import-type constructors and TsPrinter.print directly.
 */
export const test_tuple_and_import_types = (): void => {
  TestValidator.equals(
    "named tuple",
    print(
      factory.createTupleTypeNode([
        factory.createNamedTupleMember(
          undefined,
          "first",
          undefined,
          kw(SyntaxKind.StringKeyword),
        ),
        factory.createNamedTupleMember(
          factory.createToken(SyntaxKind.DotDotDotToken),
          "rest",
          undefined,
          factory.createArrayTypeNode(kw(SyntaxKind.NumberKeyword)),
        ),
      ]),
    ),
    "[first: string, ...rest: number[]]",
  );
  TestValidator.equals(
    "optional element",
    print(
      factory.createTupleTypeNode([
        factory.createOptionalTypeNode(kw(SyntaxKind.StringKeyword)),
      ]),
    ),
    "[string?]",
  );
  TestValidator.equals(
    "rest element",
    print(
      factory.createTupleTypeNode([
        factory.createRestTypeNode(
          factory.createArrayTypeNode(kw(SyntaxKind.NumberKeyword)),
        ),
      ]),
    ),
    "[...number[]]",
  );
  TestValidator.equals(
    "import type",
    print(
      factory.createImportTypeNode(
        factory.createLiteralTypeNode(str("mod")),
        undefined,
        factory.createIdentifier("Foo"),
        [ref("T")],
      ),
    ),
    `import("mod").Foo<T>`,
  );
  TestValidator.equals(
    "typeof import",
    print(
      factory.createImportTypeNode(
        factory.createLiteralTypeNode(str("mod")),
        undefined,
        undefined,
        undefined,
        true,
      ),
    ),
    `typeof import("mod")`,
  );
};
