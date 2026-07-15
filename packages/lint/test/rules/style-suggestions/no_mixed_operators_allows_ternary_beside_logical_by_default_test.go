package linthost

import "testing"

// TestNoMixedOperatorsAllowsTernaryBesideLogicalByDefault verifies that a
// logical condition beside a ternary is NOT flagged with default options.
//
// ESLint's DEFAULT_GROUPS omit the ternary ("?:") and coalesce ("??")
// operators, so `a && b ? c : d` shares no group and is left alone. This is the
// negative twin of the custom-group ternary case: it proves the conditional
// parent is inert until a group opts it in.
//
// 1. Write `const x = a && b ? c : d;`.
// 2. Enable no-mixed-operators with default options.
// 3. Assert zero findings.
func TestNoMixedOperatorsAllowsTernaryBesideLogicalByDefault(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "no-mixed-operators",
    "const x = a && b ? c : d;\n",
  )
}
