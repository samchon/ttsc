import { TestValidator } from "@nestia/e2e";
import { SyntaxKind } from "../../../../../packages/factory/src/index";

import { kw, print } from "../../internal/helpers";

/**
 * Verifies printing of every supported {@link factory.createKeywordTypeNode|keyword type}.
 *
 * Each keyword (string, number, boolean, any, unknown, void, never, object,
 * undefined, null, bigint, symbol) renders to its source text.
 *
 * 1. All twelve supported keyword types print their source keywords.
 * 2. The explicit SyntaxKind-to-text table is an independent language spelling table rather than printer-derived output.
 *
 * @evidence contracts/testing.md#behavioral-verification All twelve supported keyword types print their source keywords.
 * @evidence contracts/testing.md#independent-expectations The explicit SyntaxKind-to-text table is an independent language spelling table rather than printer-derived output.
 * @evidence contracts/testing.md#distinguishing-cases String/number/boolean/any/unknown/void/never/object/undefined/null/bigint/symbol rows retain their own labels and expected spellings.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_keyword_types. Calls createKeywordTypeNode through kw and print for each owned row.
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
