package linthost

import "testing"

// TestRuleCorpusUnicornNoImmediateMutation verifies the rule reports a
// mutating array method called directly on an array literal.
//
// The receiver-shape check fires for ArrayLiteralExpression receivers
// because `[1, 2, 3].push(4)` discards the constructed array and exposes
// only the mutator's return value (the new length). This fixture pins the
// literal-receiver arm of the rule.
//
// 1. Enable unicorn/no-immediate-mutation via an expect annotation.
// 2. Call `.push(4)` on `[1, 2, 3]` directly.
// 3. Assert the call expression is reported.
func TestRuleCorpusUnicornNoImmediateMutation(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-immediate-mutation.ts", "// expect: unicorn/no-immediate-mutation error\nconst last = [1, 2, 3].push(4);\nvoid last;\n")
}
