package linthost

import "testing"

// TestRuleCorpusUnicornNoObjectAsDefaultParameter verifies
// unicorn/no-object-as-default-parameter reports a parameter whose
// default value is a non-empty object literal.
//
// The rule visits `ParameterDeclaration`, requires a non-empty object-
// literal initializer, and skips parameters whose name is itself a
// destructuring pattern (those are already the recommended shape). This
// fixture pins the canonical positive case.
//
//  1. Enable unicorn/no-object-as-default-parameter via an expect
//     annotation.
//  2. Declare `function f(opts = { tag: "default" })`.
//  3. Assert the parameter is reported.
func TestRuleCorpusUnicornNoObjectAsDefaultParameter(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-object-as-default-parameter.ts", "// expect: unicorn/no-object-as-default-parameter error\nfunction f(opts = { tag: \"default\" }) { void opts; }\n")
}
