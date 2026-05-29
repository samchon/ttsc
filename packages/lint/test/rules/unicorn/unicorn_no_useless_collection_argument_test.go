package linthost

import "testing"

// TestRuleCorpusUnicornNoUselessCollectionArgument verifies
// unicorn/no-useless-collection-argument reports an empty array literal
// passed to `new Set(...)`.
//
// The rule matches by constructor identifier and one of four useless-argument
// shapes; `new Set([])` covers the empty-array-literal branch, which is the
// shape most often introduced by templating helpers, so locking it down here
// also guards the identifier-callee lookup that the other branches share.
//
// 1. Enable unicorn/no-useless-collection-argument via an expect annotation.
// 2. Construct a `Set` with an explicit empty array literal.
// 3. Assert the new expression is reported.
func TestRuleCorpusUnicornNoUselessCollectionArgument(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-useless-collection-argument.ts", "// expect: unicorn/no-useless-collection-argument error\nconst s = new Set([]);\n")
}
