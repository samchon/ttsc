package linthost

import "testing"

// TestPreferTemplateSkipsAllLiteralChain verifies the rule stays silent
// on a chain of nothing but string literals: `"a" + "b"`.
//
// All-literal concatenation is `no-useless-concat` territory — upstream
// prefer-template only fires when a non-literal operand is mixed in, so
// this chain must produce zero findings rather than an “ `ab` “
// rewrite. Pins the `hasOther` half of the detection gate against the
// flattening changes in the fixer.
//
// 1. Feed an all-string-literal `+` chain to the rule.
// 2. Assert prefer-template reports no findings at all.
func TestPreferTemplateSkipsAllLiteralChain(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "prefer-template",
    "const s = \"a\" + \"b\";\nJSON.stringify(s);\n",
  )
}
