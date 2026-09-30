package linthost

import "testing"

// TestRuleCorpusUnicornPreferDefaultParameters verifies the rule reports
// `param = param ?? <literal>` as the first body statement.
//
// The conservative pattern the rule targets is exactly this shape — a
// nullish-coalesce reassignment to an optional parameter. The fixture
// uses an optional string parameter so the reassigned literal type
// matches the declared parameter type, isolating the AST gate.
//
// 1. Enable unicorn/prefer-default-parameters via an expect annotation.
// 2. Reassign `name = name ?? "guest"` as the first statement.
// 3. Assert the assignment expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies a parameter is reassigned to a fallback at function entry; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-default-parameters annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; a default parameter declares the fallback directly. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferDefaultParameters is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferDefaultParameters(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-default-parameters.ts", "function f(name?: string) {\n  // expect: unicorn/prefer-default-parameters error\n  name = name ?? \"guest\";\n  return name;\n}\n")
  assertRuleSkipsSource(t, "unicorn/prefer-default-parameters", "function f(name = \"guest\") { return name; }\n")
}
