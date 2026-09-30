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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies a type guard failure throws a generic Error; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-type-error annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; the same guard failure throws TypeError. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferTypeError is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferTypeError(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-type-error.ts", "function f(x: unknown) {\n  if (typeof x !== \"number\") {\n    // expect: unicorn/prefer-type-error error\n    throw new Error(\"must be number\");\n  }\n  return x;\n}\nvoid f;\n")
  assertRuleSkipsSource(t, "unicorn/prefer-type-error", "function f(x: unknown) { if (typeof x !== \"number\") { throw new TypeError(\"must be number\"); } return x; }\n")
}
