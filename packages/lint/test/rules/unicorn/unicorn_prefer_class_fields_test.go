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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies the constructor assigns a constant field initializer; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-class-fields annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; the field initializer lives in the class declaration. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferClassFields is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferClassFields(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-class-fields.ts", "class C {\n  field: number;\n  constructor() {\n    // expect: unicorn/prefer-class-fields error\n    this.field = 1;\n  }\n}\n")
  assertRuleSkipsSource(t, "unicorn/prefer-class-fields", "class C { field = 1; }\n")
}
