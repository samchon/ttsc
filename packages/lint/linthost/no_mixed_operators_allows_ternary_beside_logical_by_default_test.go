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
//
// @evidence contracts/testing.md#behavioral-verification Permits logical conjunction beside ?: under default groups.
// @evidence contracts/testing.md#independent-expectations The default logical group does not include ternary; independently authored zero result follows its membership.
// @evidence contracts/testing.md#distinguishing-cases The custom group including ?: reports the same source in its sibling.
// @evidence contracts/testing.md#execution-ownership assertRuleSkipsSource executes this entry's exact authored source through the enabled engine rule; this Test owns its zero-finding comparison. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestNoMixedOperatorsAllowsTernaryBesideLogicalByDefault(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "no-mixed-operators",
    "const x = a && b ? c : d;\n",
  )
}
