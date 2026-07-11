package linthost

import "testing"

// TestPreferTemplateSkipsNumericOnlyChain verifies the rule stays
// silent on a `+` chain with no string-like operand: `1 + 2 + n`.
//
// Without a string literal anywhere in the chain the addition may be
// numeric, so there is nothing to convert to a template literal —
// firing here (or worse, fixing) would wrap arithmetic in `${…}` for
// no reason. Pins the `hasString && hasOther` detection gate that the
// new flattening gate leans on: the fixer only ever sees chains that
// contain at least one string-like operand.
//
// 1. Feed a numeric-only `+` chain to the rule.
// 2. Assert prefer-template reports no findings at all.
func TestPreferTemplateSkipsNumericOnlyChain(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "prefer-template",
    "const n: any = 3;\nconst s = 1 + 2 + n;\nJSON.stringify(s);\n",
  )
}
