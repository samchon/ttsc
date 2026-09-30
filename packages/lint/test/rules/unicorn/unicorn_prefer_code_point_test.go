package linthost

import "testing"

// TestRuleCorpusUnicornPreferCodePoint verifies the rule reports a
// `"a".charCodeAt(0)` call.
//
// The rule keys on the method-name identifier (`charCodeAt` /
// `fromCharCode`) of a property-access call. For `charCodeAt` the
// receiver is anything — a string literal is the smallest legible
// positive shape and matches the canonical legacy pattern that splits
// astral characters into surrogate pairs.
//
// 1. Enable unicorn/prefer-code-point via an expect annotation.
// 2. Call `"a".charCodeAt(0)` on a string literal.
// 3. Assert the call site is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies charCodeAt reads only a UTF-16 code unit; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-code-point annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; codePointAt uses the supported full-code-point API. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferCodePoint is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferCodePoint(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-code-point.ts", "// expect: unicorn/prefer-code-point error\nconst code = \"a\".charCodeAt(0);\nvoid code;\n")
  assertRuleSkipsSource(t, "unicorn/prefer-code-point", "const code = \"a\".codePointAt(0);\n")
}
