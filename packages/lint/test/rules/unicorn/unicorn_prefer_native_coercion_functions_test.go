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
func TestRuleCorpusUnicornPreferNativeCoercionFunctions(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-native-coercion-functions.ts", "// expect: unicorn/prefer-native-coercion-functions error\nconst xs = [\"1\", \"2\"].map((x) => Number(x));\nvoid xs;\n")
}
