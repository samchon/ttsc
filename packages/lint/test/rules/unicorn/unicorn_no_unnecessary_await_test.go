package linthost

import "testing"

// TestRuleCorpusUnicornNoUnnecessaryAwait verifies
// unicorn/no-unnecessary-await reports `await` applied to a literal
// value that the parser already pins as not-thenable.
//
// Without type information, the rule only fires on syntactic non-promise
// shapes: string/number/bigint/regex/template literals, true/false/null,
// and array/object literals. This fixture pins the numeric-literal case
// so the operand-kind switch stays covered.
//
// 1. Enable unicorn/no-unnecessary-await via an expect annotation.
// 2. Write `await 42` inside an `async function`.
// 3. Assert the await expression is reported.
func TestRuleCorpusUnicornNoUnnecessaryAwait(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-unnecessary-await.ts", "async function f() {\n  // expect: unicorn/no-unnecessary-await error\n  const x = await 42;\n  void x;\n}\nvoid f;\n")
}
