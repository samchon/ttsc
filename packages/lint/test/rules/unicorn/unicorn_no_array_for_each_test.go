package linthost

import "testing"

// TestRuleCorpusUnicornNoArrayForEach verifies unicorn/no-array-for-each
// reports a direct `.forEach(...)` call on an array literal.
//
// The rule visits every `CallExpression` and matches purely on the
// property-access callee's method name; the receiver is not type-checked,
// so the array-literal receiver here is enough to exercise the only
// branch the rule has.
//
// 1. Enable unicorn/no-array-for-each via an expect annotation.
// 2. Call `.forEach` on an inline array literal.
// 3. Assert the call expression is reported.
func TestRuleCorpusUnicornNoArrayForEach(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-array-for-each.ts", "// expect: unicorn/no-array-for-each error\n[1, 2, 3].forEach((x) => { console.log(x); });\n")
}
