package linthost

import "testing"

// TestRuleCorpusUnicornPreferTopLevelAwait verifies
// unicorn/prefer-top-level-await reports a `.then(cb)` call at the top
// level of an ES module.
//
// The rule visits CallExpression, checks the callee is
// `PropertyAccess(_, then)`, and walks ancestors looking for a
// SourceFile parent (stopping at any function/class/block boundary).
// This fixture pins the bare top-level `.then` chain so the parent-walk
// gate stays covered.
//
// 1. Enable unicorn/prefer-top-level-await via an expect annotation.
// 2. Call `load().then((s) => …)` directly at the top level.
// 3. Assert the call expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies a top-level promise then callback replaces direct await; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-top-level-await annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; top-level await obtains the same loaded result. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferTopLevelAwait is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferTopLevelAwait(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-top-level-await.ts", "declare function load(): Promise<string>;\n// expect: unicorn/prefer-top-level-await error\nload().then((s) => {\n  void s;\n});\n")
  assertRuleSkipsSource(t, "unicorn/prefer-top-level-await", "declare function load(): Promise<string>; const s = await load(); void s;\n")
}
