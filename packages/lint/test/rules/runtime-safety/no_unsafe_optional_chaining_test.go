package linthost

import "testing"

// TestRuleCorpusNoUnsafeOptionalChaining verifies the lint rule corpus
// fixture no-unsafe-optional-chaining.ts.
//
// The rule fires on member access, element access, or call expressions
// whose receiver terminates in an optional `?.` operator without the
// outer access continuing the chain.
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original ordinary member access after a terminated optional chain while permitting a fully continued optional chain.
// @evidence contracts/testing.md#independent-expectations Parenthesizing obj?.foo before ordinary .bar loses optional-chain short-circuiting; the annotated expression supplies the independent unsafe boundary.
// @evidence contracts/testing.md#distinguishing-cases The terminated (obj?.foo).bar reports; obj?.foo?.bar remains clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoUnsafeOptionalChaining is selected in the shared Go unit population. It passes the authored no-unsafe-optional-chaining.ts fixture through assertRuleCorpusCase to the owning AST Engine and runs the additional clean source through assertRuleSkipsSource. No consumer install, native artifact build or real product host runs.
func TestRuleCorpusNoUnsafeOptionalChaining(t *testing.T) {
  assertRuleCorpusCase(t, "no-unsafe-optional-chaining.ts", "declare const obj: { foo?: { bar: number } } | undefined;\n// expect: no-unsafe-optional-chaining error\nconst x = (obj?.foo).bar;\nJSON.stringify(x);\n")
  assertRuleSkipsSource(t, "no-unsafe-optional-chaining", "const value = obj?.foo?.bar;\n")
}
