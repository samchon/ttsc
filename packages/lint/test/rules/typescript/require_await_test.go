package linthost

import "testing"

// TestRuleCorpusRequireAwait verifies the lint rule corpus fixture
// require-await.ts.
//
// The rule walks the body of every async function-like declaration and
// reports when no `await` is reachable without crossing a nested function
// boundary, and when the body also returns nothing thenable. The Go unit
// case below pins the minimum-viable trigger — a literal return, which
// neither awaits nor forwards a promise — so a regression in modifier
// scanning or the body walker surfaces here without depending on the
// full fixture.
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
func TestRuleCorpusRequireAwait(t *testing.T) {
  assertRuleCorpusCase(t, "require-await.ts", "// expect: typescript/require-await error\nasync function noAwait(): Promise<number> {\n  return 0;\n}\nJSON.stringify(noAwait);\n")
}
