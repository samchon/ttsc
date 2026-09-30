package linthost

import "testing"

// TestRuleCorpusUnicornRequireNumberToFixedDigitsArgument verifies
// unicorn/require-number-to-fixed-digits-argument reports a
// zero-argument `.toFixed()` call.
//
// The rule visits every `CallExpression` and matches purely on the
// property-access callee's method name plus the zero-arg shape; the
// receiver is not type-checked, so a parenthesized numeric literal is
// enough to exercise the rule's only firing branch.
//
// 1. Enable unicorn/require-number-to-fixed-digits-argument via an expect annotation.
// 2. Call `.toFixed()` on a numeric literal with no arguments.
// 3. Assert the call expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies toFixed omits its digits argument; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/require-number-to-fixed-digits-argument annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; toFixed explicitly supplies the intended digits. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornRequireNumberToFixedDigitsArgument is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornRequireNumberToFixedDigitsArgument(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/require-number-to-fixed-digits-argument.ts", "// expect: unicorn/require-number-to-fixed-digits-argument error\nconst s = (1.234).toFixed();\n")
  assertRuleSkipsSource(t, "unicorn/require-number-to-fixed-digits-argument", "const s = (1.234).toFixed(2);\n")
}
