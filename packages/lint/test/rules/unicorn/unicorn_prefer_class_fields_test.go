package linthost

import "testing"

// TestRuleCorpusUnicornPreferClassFields verifies the rule reports
// `this.field = <literal>` inside a constructor.
//
// The detection keys on the constructor body, the assignment shape, and
// the primitive-literal RHS — the three gates that distinguish the
// "hoistable initializer" pattern from real constructor work. A single
// number-literal assignment is the minimal positive case.
//
// 1. Enable unicorn/prefer-class-fields via an expect annotation.
// 2. Assign `this.field = 1` from inside the constructor.
// 3. Assert the assignment expression is reported.
func TestRuleCorpusUnicornPreferClassFields(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/prefer-class-fields.ts", "class C {\n  field: number;\n  constructor() {\n    // expect: unicorn/prefer-class-fields error\n    this.field = 1;\n  }\n}\n")
}
