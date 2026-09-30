package linthost

import "testing"

// TestRuleCorpusUnicornExpiringTodoComments verifies
// unicorn/expiring-todo-comments reports a bare `// TODO:` comment that
// carries no `[...]` expiration block.
//
// The rule walks every comment via the tsgo scanner and matches the
// stripped body against `(?i)(TODO|FIXME|XXX)\b(?!.*\[)`, so a comment
// with the keyword and no expiration block pins the positive case and
// guards the scanner-driven iteration.
//
// 1. Enable unicorn/expiring-todo-comments via an expect annotation.
// 2. Place a `// TODO: fix this` comment ahead of a trivial statement.
// 3. Assert the comment is reported at its source range.
//
// @evidence contracts/testing.md#behavioral-verification Actual engine annotation and zero-finding assertions distinguish an unbounded TODO comment from an explicitly scheduled comment and ordinary string text.
// @evidence contracts/testing.md#independent-expectations The supported expiration-required comment policy establishes the literal bare TODO diagnostic and accepted future-expiration/string controls.
// @evidence contracts/testing.md#distinguishing-cases The original unscheduled TODO reports; a bracketed 2099-12-31 deadline, a completed-work comment and TODO text inside a string must stay clean. This does not claim expired-date evaluation.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornExpiringTodoComments owns this authored source matrix as one discoverable Go unit entry. Its authored positive and negative ASTs execute the owning engine in the shared Go process; corpus/zero-finding failures retain fixture source identity. No installed consumer, native build or child product host runs.
func TestRuleCorpusUnicornExpiringTodoComments(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/expiring-todo-comments.ts", "// expect: unicorn/expiring-todo-comments error\n// TODO: fix this\nvoid 0;\n")
  assertRuleSkipsSource(t, "unicorn/expiring-todo-comments", "// TODO [2099-12-31]: revisit this\nvoid 0;\n")
  assertRuleSkipsSource(t, "unicorn/expiring-todo-comments", "// Completed this work.\nconst text = 'TODO: not a comment';\nvoid text;\n")
}
