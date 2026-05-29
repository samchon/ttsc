package linthost

import "testing"

// TestRuleCorpusUnicornNoAccessorRecursion verifies the rule reports
// `this.value` reads inside a `get value()` accessor.
//
// The accessor name is captured from the declaration and matched against
// every `this.<X>` read inside the body — the recursive call would hit
// the same getter and overflow the stack. This fixture pins the getter
// arm of the rule.
//
// 1. Enable unicorn/no-accessor-recursion via an expect annotation.
// 2. Define `get value()` that returns `this.value`.
// 3. Assert the recursive property access is reported.
func TestRuleCorpusUnicornNoAccessorRecursion(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-accessor-recursion.ts", "class C {\n  get value() {\n    // expect: unicorn/no-accessor-recursion error\n    return this.value;\n  }\n}\nvoid C;\n")
}
