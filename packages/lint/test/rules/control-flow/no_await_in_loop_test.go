package linthost

import "testing"

// TestRuleCorpusNoAwaitInLoop verifies the lint rule corpus fixture
// no-await-in-loop.ts.
//
// The rule walks up from an `await` expression to find the nearest
// enclosing loop, stopping at function-like boundaries. `for await … of`
// loops are exempt by design — the awaited iterator IS the loop.
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
func TestRuleCorpusNoAwaitInLoop(t *testing.T) {
  assertRuleCorpusCase(t, "no-await-in-loop.ts", "async function inLoop(): Promise<number> {\n  let total = 0;\n  for (let i = 0; i < 3; i++) {\n    // expect: no-await-in-loop error\n    total += await Promise.resolve(1);\n  }\n  return total;\n}\nJSON.stringify(inLoop);\n")
}
