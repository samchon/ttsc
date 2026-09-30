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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies map immediately followed by flat has a dedicated flatMap form; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-array-flat-map annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; flatMap performs the mapping and flattening in one operation. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferArrayFlatMap is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferArrayFlatMap(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-array-flat-map.ts", "// expect: unicorn/prefer-array-flat-map error\nconst result = [1, 2].map((x) => [x, x]).flat();\n")
  assertRuleSkipsSource(t, "unicorn/prefer-array-flat-map", "const result = [1,2].flatMap(x => [x,x]);\n")
}
