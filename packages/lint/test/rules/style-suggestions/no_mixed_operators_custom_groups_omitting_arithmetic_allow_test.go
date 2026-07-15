package linthost

import "testing"

// TestNoMixedOperatorsCustomGroupsOmittingArithmeticAllow verifies that a
// custom `groups` option without an arithmetic family silences `a + b * c`.
//
// A non-empty `groups` array replaces the defaults wholesale (ESLint's
// normalizeOptions). With only logical and bitwise families configured, `+`
// and `*` share no group, so the mix that the default set reports is now
// allowed — proving the option overrides the built-in groups.
//
// 1. Write `const x = a + b * c;` and configure groups without arithmetic.
// 2. Run no-mixed-operators with that option blob.
// 3. Assert zero findings.
func TestNoMixedOperatorsCustomGroupsOmittingArithmeticAllow(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "no-mixed-operators",
    "const x = a + b * c;\n",
    `{"groups":[["&&","||"],["&","|","^"]]}`,
  )
}
