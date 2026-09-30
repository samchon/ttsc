package linthost

import "testing"

// TestRuleCorpusNoAwaitInLoop verifies the lint rule corpus fixture
// no-await-in-loop.ts.
//
// The rule walks from each explicit or implicit await through repeated loop
// positions, stopping at function-like and intentional for-await boundaries.
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original repeated loop-body await and permits an await outside a loop.
// @evidence contracts/testing.md#independent-expectations A conventional loop body repeats while a standalone function-body await has no loop serialization; authored annotation fixes the original site.
// @evidence contracts/testing.md#distinguishing-cases Loop-body await reports; one standalone await remains clean. The complete traversal case owns once-only headers, implicit awaits and function boundaries.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoAwaitInLoop is selected in the shared Go unit population. It calls assertRuleCorpusCase with no-await-in-loop.ts through the owning Engine and assertRuleSkipsSource for the clean input. No installed consumer, native artifact build or real host runs.
func TestRuleCorpusNoAwaitInLoop(t *testing.T) {
  assertRuleCorpusCase(t, "no-await-in-loop.ts", "async function inLoop(): Promise<number> {\n  let total = 0;\n  for (let i = 0; i < 3; i++) {\n    // expect: no-await-in-loop error\n    total += await Promise.resolve(1);\n  }\n  return total;\n}\nJSON.stringify(inLoop);\n")
  assertRuleSkipsSource(t, "no-await-in-loop", "async function once() { await Promise.resolve(1); }\n")
}
