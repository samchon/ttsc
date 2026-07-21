import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind } from "@ttsc/factory";

import { kw, print, ref, str } from "../../internal/helpers";

/**
 * Print named / optional / rest tuple members and import types.
 *
 * A labeled tuple `[first: string, ...rest: number[]]`, optional `[string?]`,
 * rest `[...number[]]`, an `import("mod").Foo<T>` type, and a `typeof import`.
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
        false,
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
        true,
        factory.createLiteralTypeNode(str("mod")),
      ),
    ),
    `typeof import("mod")`,
  );
};
