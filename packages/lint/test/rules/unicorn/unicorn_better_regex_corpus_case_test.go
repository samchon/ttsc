package linthost

import "testing"

// TestRuleCorpusUnicornBetterRegex verifies unicorn/better-regex reports the
// corpus fixture's optimizable literal through the native engine.
//
// Mirrors tests/test-lint/src/cases/unicorn-better-regex.ts so the Go rule
// corpus and the end-to-end TS corpus stay in lockstep; `[0-9]` is the
// canonical character-class-to-shorthand case (`\d`), the rule's headline
// transformation.
//
//  1. Enable unicorn/better-regex via an expect annotation.
//  2. Declare a const initialized to `/[0-9]/`.
//  3. Assert the literal is reported.
func TestRuleCorpusUnicornBetterRegex(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/better-regex.ts", "// expect: unicorn/better-regex error\nconst digits = /[0-9]/;\n")
}
