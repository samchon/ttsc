package linthost

import "testing"

// TestNoMixedOperatorsAllowsBitwiseBesideLogical verifies `a | b && c` is NOT
// flagged.
//
// This is the false positive from issue #611: the earlier port paired across
// families and reported it. Upstream fires only within one group — `|`
// (bitwise) and `&&` (logical) live in different default groups — so the mix
// is left alone.
//
// 1. Write `const x = a | b && c;` (parses as `(a | b) && c`).
// 2. Enable no-mixed-operators with default options.
// 3. Assert zero findings.
func TestNoMixedOperatorsAllowsBitwiseBesideLogical(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "no-mixed-operators",
    "const x = a | b && c;\n",
  )
}
