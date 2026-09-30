package linthost

import "testing"

// TestRuleCorpusNoNewSymbol verifies the lint rule corpus fixture
// no-new-symbol.ts.
//
// `Symbol` is a function but not a constructor; calling it with `new`
// throws a TypeError at runtime.
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification Engine rejects the original new Symbol construction while permitting the Symbol factory call.
// @evidence contracts/testing.md#independent-expectations Symbol is callable but not constructible; the authored new-expression annotation follows that language contract independently.
// @evidence contracts/testing.md#distinguishing-cases new Symbol reports; Symbol("desc") remains clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoNewSymbol is selected in the shared Go unit population. It passes the authored no-new-symbol.ts fixture through assertRuleCorpusCase to the owning AST Engine and runs the additional clean source through assertRuleSkipsSource. No consumer install, native artifact build or real product host runs.
func TestRuleCorpusNoNewSymbol(t *testing.T) {
  assertRuleCorpusCase(t, "no-new-symbol.ts", "// expect: no-new-symbol error\nconst bad = new Symbol(\"desc\");\nJSON.stringify(bad);\n")
  assertRuleSkipsSource(t, "no-new-symbol", "const value = Symbol(\"desc\");\n")
}
