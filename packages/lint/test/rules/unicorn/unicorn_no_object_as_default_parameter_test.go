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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies a default parameter allocates an object value; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-object-as-default-parameter annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; a scalar default does not allocate a default object. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoObjectAsDefaultParameter is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoObjectAsDefaultParameter(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-object-as-default-parameter.ts", "// expect: unicorn/no-object-as-default-parameter error\nfunction f(opts = { tag: \"default\" }) { void opts; }\n")
  assertRuleSkipsSource(t, "unicorn/no-object-as-default-parameter", "function f(tag = \"default\") { void tag; }\n")
}
