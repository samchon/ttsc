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
func TestRuleCorpusUnicornPreferDefaultParameters(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/prefer-default-parameters.ts", "function f(name?: string) {\n  // expect: unicorn/prefer-default-parameters error\n  name = name ?? \"guest\";\n  return name;\n}\n")
}
