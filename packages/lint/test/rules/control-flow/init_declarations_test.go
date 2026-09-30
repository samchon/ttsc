package linthost

import "testing"

// TestRuleCorpusInitDeclarations verifies the lint rule corpus fixture
// init-declarations.ts.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its `// expect:` comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original uninitialized let/var declarations while preserving initialized let and const.
// @evidence contracts/testing.md#independent-expectations The default always-initialize policy independently selects declarations lacking a value; later assignment does not initialize the declaration site.
// @evidence contracts/testing.md#distinguishing-cases Uninitialized let and var report; ready = 0 and fixed = 42 stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusInitDeclarations is selected in the shared Go unit population. It calls assertRuleCorpusCase with init-declarations.ts through the owning Engine. No installed consumer, native artifact build or real host runs.
func TestRuleCorpusInitDeclarations(t *testing.T) {
  assertRuleCorpusCase(t, "init-declarations.ts", "// Positive: a `let` declaration without an initializer leaves the\n// binding implicitly `undefined` — initialize it at the declaration\n// site instead.\n// expect: init-declarations error\nlet pending: number | undefined;\npending = 1;\n\n// Positive: same shape applied to `var`.\n// expect: init-declarations error\nvar legacy: string | undefined;\nlegacy = \"ok\";\n\n// Negative: `let` with an initializer is fine.\nlet ready = 0;\n\n// Negative: `const` is exempt — the grammar already requires the\n// initializer, so the rule has nothing extra to enforce.\nconst fixed = 42;\n\nJSON.stringify({ pending, legacy, ready, fixed });\n")
}
