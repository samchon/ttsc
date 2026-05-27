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
func TestRuleCorpusUnicornExpiringTodoComments(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/expiring-todo-comments.ts", "// expect: unicorn/expiring-todo-comments error\n// TODO: fix this\nvoid 0;\n")
}
