package linthost

import "testing"

// TestRuleCorpusUnicornSwitchCaseBraces verifies unicorn/switch-case-braces
// reports a `case` clause whose body is multiple bare statements rather
// than a single `{ ... }` block.
//
// The default "always" mode requires every clause body to be a single
// `Block`; two statements in the same clause violates that shape and
// surfaces the rule on the case clause itself.
//
// 1. Enable unicorn/switch-case-braces via an expect annotation.
// 2. Write a `case` clause whose body is `void 0; break;` (no braces).
// 3. Assert the case clause is reported.
func TestRuleCorpusUnicornSwitchCaseBraces(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/switch-case-braces.ts", "declare const k: string;\nswitch (k) {\n  // expect: unicorn/switch-case-braces error\n  case \"a\":\n    void 0;\n    break;\n}\n")
}
