package linthost

import "testing"

// TestRuleCorpusUnicornPreferNativeCoercionFunctions verifies
// unicorn/prefer-native-coercion-functions reports `(x) => Number(x)`.
//
// The fixture pins the concise-arrow shape — single bare-identifier
// parameter, expression body that calls `Number(<param>)` — because the
// block-body and other-constructor branches all flow through the same
// param-identity check. An `.map` call site keeps the arrow in expression
// position so the rule fires on the function node directly.
//
// 1. Enable unicorn/prefer-native-coercion-functions via an expect annotation.
// 2. Map an array through `(x) => Number(x)`.
// 3. Assert the arrow expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies an arrow only forwards its argument to Number; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-native-coercion-functions annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; map receives Number as the coercion callback directly. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferNativeCoercionFunctions is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferNativeCoercionFunctions(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-native-coercion-functions.ts", "// expect: unicorn/prefer-native-coercion-functions error\nconst xs = [\"1\", \"2\"].map((x) => Number(x));\nvoid xs;\n")
  assertRuleSkipsSource(t, "unicorn/prefer-native-coercion-functions", "const xs = [\"1\",\"2\"].map(Number);\n")
}
