import { TestValidator } from "@nestia/e2e";
import { SyntaxKind } from "@ttsc/factory";

import { kw, print } from "../../internal/helpers";

/**
 * Print every supported {@link factory.createKeywordTypeNode|keyword type}.
 *
 * Each keyword (string, number, boolean, any, unknown, void, never, object,
 * undefined, null, bigint, symbol) renders to its source text.
 */
export const test_keyword_types = (): void => {
  const pairs: [SyntaxKind, string][] = [
    [SyntaxKind.StringKeyword, "string"],
    [SyntaxKind.NumberKeyword, "number"],
    [SyntaxKind.BooleanKeyword, "boolean"],
    [SyntaxKind.AnyKeyword, "any"],
    [SyntaxKind.UnknownKeyword, "unknown"],
    [SyntaxKind.VoidKeyword, "void"],
    [SyntaxKind.NeverKeyword, "never"],
    [SyntaxKind.ObjectKeyword, "object"],
    [SyntaxKind.UndefinedKeyword, "undefined"],
    [SyntaxKind.NullKeyword, "null"],
    [SyntaxKind.BigIntKeyword, "bigint"],
    [SyntaxKind.SymbolKeyword, "symbol"],
  ];
  for (const [k, text] of pairs) TestValidator.equals(text, print(kw(k)), text);
};
