package linthost

import "testing"

// TestRuleCorpusUnicornPreferObjectFromEntries verifies
// unicorn/prefer-object-from-entries reports `.reduce(reducer, {})`.
//
// The fixture pins the canonical empty-object-seed shape — a two-argument
// `.reduce` whose second argument is `{}` — because the reducer body is
// intentionally not inspected: any `.reduce(_, {})` is, in practice, a
// from-entries pattern. A small typed entry array keeps the AST shape
// clear without dragging in helper types.
//
// 1. Enable unicorn/prefer-object-from-entries via an expect annotation.
// 2. Declare `const obj = entries.reduce(reducer, {});`.
// 3. Assert the call expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies reduce builds an object from entry pairs; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-object-from-entries annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; Object.fromEntries consumes the same entry pairs. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferObjectFromEntries is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferObjectFromEntries(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-object-from-entries.ts", "const entries: Array<[string, number]> = [[\"a\", 1]];\n// expect: unicorn/prefer-object-from-entries error\nconst obj = entries.reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});\nvoid obj;\n")
  assertRuleSkipsSource(t, "unicorn/prefer-object-from-entries", "const entries: Array<[string,number]> = [[\"a\",1]]; const obj = Object.fromEntries(entries);\n")
}
