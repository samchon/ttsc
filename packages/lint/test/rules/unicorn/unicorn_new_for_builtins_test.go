package linthost

import "testing"

// TestRuleCorpusUnicornNewForBuiltins verifies unicorn/new-for-builtins reports
// a call-form Array constructor that should use `new`.
//
// The rule splits built-ins into two groups: primitive wrappers must be called
// without `new`, while container constructors like Array must be called with
// `new`. This fixture pins the container branch with `Array(3)` — the canonical
// sparse-allocation footgun the rule exists to prevent.
//
// 1. Enable unicorn/new-for-builtins via an expect annotation.
// 2. Call `Array(3)` without `new`.
// 3. Assert the call expression is reported.
func TestRuleCorpusUnicornNewForBuiltins(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/new-for-builtins.ts", "// expect: unicorn/new-for-builtins error\nconst xs = Array(3);\nvoid xs;\n")
}
