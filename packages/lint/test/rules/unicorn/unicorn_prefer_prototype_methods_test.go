package linthost

import "testing"

// TestRuleCorpusUnicornPreferPrototypeMethods verifies
// unicorn/prefer-prototype-methods reports `[].slice`-style empty-literal
// property accesses used to borrow a prototype method.
//
// The rule matches `PropertyAccessExpression` nodes whose receiver is an
// empty `[]` or `{}` literal. This fixture pins the array-arm with the
// canonical `[].slice` shorthand so the empty-elements guard stays
// covered.
//
// 1. Enable unicorn/prefer-prototype-methods via an expect annotation.
// 2. Read `[].slice` to borrow `Array.prototype.slice`.
// 3. Assert the property-access expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies a throwaway array literal is used only to retrieve slice; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-prototype-methods annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; Array.prototype supplies the same method without allocating an array. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferPrototypeMethods is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferPrototypeMethods(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-prototype-methods.ts", "// expect: unicorn/prefer-prototype-methods error\nconst slice = [].slice;\nvoid slice;\n")
  assertRuleSkipsSource(t, "unicorn/prefer-prototype-methods", "const slice = Array.prototype.slice;\n")
}
