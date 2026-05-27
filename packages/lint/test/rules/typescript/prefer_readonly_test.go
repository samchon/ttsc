package linthost

import "testing"

// TestRuleCorpusPreferReadonly verifies the lint rule corpus fixture
// typescript-prefer-readonly.ts.
//
// The AST-only baseline fires on private class fields (either via the
// `private` modifier or the `#name` form) that do not already carry
// `readonly` and are initialized at the declaration site. Fields without
// an initializer, already-readonly fields, and non-private fields are
// skipped.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusPreferReadonly(t *testing.T) {
	assertRuleCorpusCase(t, "typescript-prefer-readonly.ts", "class Foo {\n  // expect: typescript/prefer-readonly error\n  private a = 1;\n\n  // expect: typescript/prefer-readonly error\n  #b = 2;\n\n  // Already readonly — never fires.\n  private readonly c = 3;\n\n  // No initializer — the AST-only baseline cannot prove it is only\n  // assigned in the constructor, so the rule stays silent.\n  private d: number;\n\n  // Not private — outside callers may write to it.\n  e = 5;\n\n  constructor() {\n    this.d = 4;\n  }\n}\n\nJSON.stringify(new Foo());\n")
}
