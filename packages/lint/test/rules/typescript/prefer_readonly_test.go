package linthost

import "testing"

// TestRuleCorpusPreferReadonly verifies the lint rule corpus fixture
// typescript-prefer-readonly.ts.
//
// The Checker-backed rule reports initialized private fields with no resolved
// source-file reassignment. This original fixture preserves its private/hash
// positive markers and readonly/public/uninitialized distinctions; the companion
// write-census test owns assignments and aliases. Reflective and any-typed
// mutation are outside the resolved-write diagnostic's stated boundary.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
// @evidence contracts/testing.md#behavioral-verification Supported initialized private fields must report readonly preference.
// @evidence contracts/testing.md#independent-expectations Two authored markers fix exact error triples for private a and private-hash b.
// @evidence contracts/testing.md#distinguishing-cases Already-readonly, uninitialized private and externally writable public fields remain clean; the companion write-census test distinguishes resolved writes, while reflective/any-typed mutation is outside the diagnostic boundary.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPreferReadonly invokes assertRuleCorpusCase and its real Program/Checker when required by the rule in one shared Go unit process; all original inputs/assertions remain and no child compiler, native build or installed consumer runs.
func TestRuleCorpusPreferReadonly(t *testing.T) {
  assertRuleCorpusCase(t, "typescript-prefer-readonly.ts", "class Foo {\n  // expect: typescript/prefer-readonly error\n  private a = 1;\n\n  // expect: typescript/prefer-readonly error\n  #b = 2;\n\n  // Already readonly — never fires.\n  private readonly c = 3;\n\n  // No initializer — the AST-only baseline cannot prove it is only\n  // assigned in the constructor, so the rule stays silent.\n  private d: number;\n\n  // Not private — outside callers may write to it.\n  e = 5;\n\n  constructor() {\n    this.d = 4;\n  }\n}\n\nJSON.stringify(new Foo());\n")
}
