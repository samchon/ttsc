package linthost

import "testing"

// TestNoMixedOperatorsCustomGroupsOmittingArithmeticAllow verifies that a
// custom `groups` option without an arithmetic family silences `a + b * c`.
//
// A non-empty `groups` array replaces the defaults wholesale (ESLint's
// normalizeOptions). With only logical and bitwise families configured, `+`
// and `*` share no group, so the mix that the default set reports is now
// allowed, proving the option overrides the built-in groups.
//
// 1. Write `const x = a + b * c;` and configure groups without arithmetic.
// 2. Run no-mixed-operators with that option blob.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Permits +/* mixing when custom groups omit arithmetic.
// @evidence contracts/testing.md#independent-expectations The authored groups include only logical and bitwise operators; absent arithmetic membership independently requires zero reports.
// @evidence contracts/testing.md#distinguishing-cases A normally positive default expression becomes negative under custom groups, isolating replacement rather than union of groups.
// @evidence contracts/testing.md#execution-ownership assertRuleSkipsSourceWithOptions executes the authored omitted-arithmetic groups and source. This Test owns the resulting zero findings. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestNoMixedOperatorsCustomGroupsOmittingArithmeticAllow(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "no-mixed-operators",
    "const x = a + b * c;\n",
    `{"groups":[["&&","||"],["&","|","^"]]}`,
  )
}
