package linthost

import "testing"

// TestRuleCorpusUnicornPreferArrayFlatMap verifies unicorn/prefer-array-flat-map
// reports the chained `.map(...).flat()` shape.
//
// The rule pins one outer `CallExpression` whose `.flat` callee receives a
// `.map` callsite; this fixture is the minimal positive case so regressions in
// nested-call traversal or in property-access identifier matching surface
// immediately.
//
// 1. Enable unicorn/prefer-array-flat-map via an expect annotation.
// 2. Chain a literal array's `.map(...)` into `.flat()`.
// 3. Assert the outer call expression is reported.
func TestRuleCorpusUnicornPreferArrayFlatMap(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-array-flat-map.ts", "// expect: unicorn/prefer-array-flat-map error\nconst result = [1, 2].map((x) => [x, x]).flat();\n")
}
