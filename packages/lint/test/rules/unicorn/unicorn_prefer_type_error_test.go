package linthost

import "testing"

// TestRuleCorpusUnicornPreferTypeError verifies the rule reports
// `throw new Error(...)` inside a guard whose condition is a `typeof` check.
//
// The matcher fires when the if-condition is a runtime type test and the
// then-branch is a single `throw new Error(...)`; `TypeError` is the
// language-blessed class for type-mismatch errors. This fixture pins the
// `typeof x !== "number"` arm.
//
// 1. Enable unicorn/prefer-type-error via an expect annotation.
// 2. Throw `new Error(...)` inside a `typeof` guard.
// 3. Assert the throw statement is reported.
func TestRuleCorpusUnicornPreferTypeError(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/prefer-type-error.ts", "function f(x: unknown) {\n  if (typeof x !== \"number\") {\n    // expect: unicorn/prefer-type-error error\n    throw new Error(\"must be number\");\n  }\n  return x;\n}\nvoid f;\n")
}
