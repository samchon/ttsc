package linthost

import "testing"

// TestRuleCorpusUnicornPreferSetSize verifies unicorn/prefer-set-size
// reports `[...set].length`.
//
// The rule keys purely on the syntactic shape (`[...x].length`), not on
// the receiver's type, so a `declare const s: Set<number>` followed by
// the spread-length expression is enough to exercise the only branch
// the rule has.
//
// 1. Enable unicorn/prefer-set-size via an expect annotation.
// 2. Read `[...s].length` on a declared Set binding.
// 3. Assert the property-access expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies a Set is materialized as an array only to read its length; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-set-size annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; the same Set exposes its size directly. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferSetSize is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferSetSize(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-set-size.ts", "declare const s: Set<number>;\n// expect: unicorn/prefer-set-size error\nconst n = [...s].length;\n")
  assertRuleSkipsSource(t, "unicorn/prefer-set-size", "declare const s: Set<number>; const n = s.size;\n")
}
