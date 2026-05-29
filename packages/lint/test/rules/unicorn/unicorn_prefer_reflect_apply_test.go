package linthost

import "testing"

// TestRuleCorpusUnicornPreferReflectApply verifies
// unicorn/prefer-reflect-apply reports the `Function.prototype.apply.call(…)`
// invocation chain.
//
// The rule recognizes the callsite by textual identity of the callee
// expression against the literal chain `Function.prototype.apply.call`.
// This fixture pins the canonical positive case so the text-equality
// match isn't loosened to allow false positives like `Foo.apply.call`.
//
// 1. Enable unicorn/prefer-reflect-apply via an expect annotation.
// 2. Call `Function.prototype.apply.call(f, null, [1, 2])`.
// 3. Assert the call expression is reported.
func TestRuleCorpusUnicornPreferReflectApply(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-reflect-apply.ts", "function f(a: number, b: number) { return a + b; }\n// expect: unicorn/prefer-reflect-apply error\nconst r = Function.prototype.apply.call(f, null, [1, 2]);\nvoid r;\n")
}
