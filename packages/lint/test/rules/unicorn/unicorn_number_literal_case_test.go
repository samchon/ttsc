package linthost

import "testing"

const unicornNumberLiteralCaseRuleName = "unicorn/number-literal-case"

// TestRuleCorpusUnicornNumberLiteralCase verifies the lint rule corpus fixture
// unicorn-number-literal-case.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage, so this
// scenario embeds that fixture verbatim and ties it to the native Engine. It pins the
// whole canonical spelling one literal at a time — mis-cased hex digits, an uppercase
// radix prefix (hex, binary, octal), an uppercase exponent (bare, signed, fractional),
// and a BigInt — while the trailing already-canonical literals must stay silent.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusUnicornNumberLiteralCase(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/number-literal-case.ts", "// expect: unicorn/number-literal-case error\nconst n = 0xff;\n\n// expect: unicorn/number-literal-case error\nconst prefix = 0XFF;\n\n// expect: unicorn/number-literal-case error\nconst binary = 0B1010;\n\n// expect: unicorn/number-literal-case error\nconst octal = 0O17;\n\n// expect: unicorn/number-literal-case error\nconst exponent = 1E10;\n\n// expect: unicorn/number-literal-case error\nconst signedExponent = 2E-5;\n\n// expect: unicorn/number-literal-case error\nconst fraction = 0.5E3;\n\n// expect: unicorn/number-literal-case error\nconst big = 0xffn;\n\nconst canonicalHex = 0xFF;\nconst canonicalExponent = 1e10;\nconst canonicalBig = 0xFF_FFn;\nconst canonicalDecimal = 1_000_000;\n")
}
