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
func TestRuleCorpusUnicornPreferTopLevelAwait(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-top-level-await.ts", "declare function load(): Promise<string>;\n// expect: unicorn/prefer-top-level-await error\nload().then((s) => {\n  void s;\n});\n")
}
