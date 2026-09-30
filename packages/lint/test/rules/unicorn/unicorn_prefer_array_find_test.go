package linthost

import "testing"

// TestRuleCorpusUnicornPreferArrayFind verifies unicorn/prefer-array-find reports
// the `xs.filter(...)[0]` shape.
//
// The rule walks the element-access expression and requires both the `filter`
// callee identifier and the numeric `0` index argument. This fixture pins the
// minimal positive shape: a literal array receiver, an arrow predicate, and the
// canonical `[0]` projection.
//
// 1. Enable unicorn/prefer-array-find via an expect annotation.
// 2. Project `xs.filter((x) => x > 1)[0]` to the element-access expression.
// 3. Assert the element access is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies filter materializes an array to read only its first element; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-array-find annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; find returns that first matching element directly. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferArrayFind is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferArrayFind(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-array-find.ts", "const xs = [1, 2, 3];\n// expect: unicorn/prefer-array-find error\nconst first = xs.filter((x) => x > 1)[0];\n")
  assertRuleSkipsSource(t, "unicorn/prefer-array-find", "const xs = [1,2,3]; const first = xs.find(x => x > 1);\n")
}
