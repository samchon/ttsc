package linthost

import "testing"

// TestRuleCorpusUnicornNoInvalidRemoveEventListener verifies the rule reports
// `removeEventListener` calls passed a fresh arrow function.
//
// The matcher fires when the handler argument is an arrow function or
// function-expression literal because the listener registry compares handlers
// by reference identity and a fresh literal will never match a previously
// registered listener. This fixture pins the arrow-function arm so the no-op
// shape stays exercised.
//
// 1. Enable unicorn/no-invalid-remove-event-listener via an expect annotation.
// 2. Call `el.removeEventListener("click", () => {})` with a fresh arrow.
// 3. Assert the call expression is reported.
func TestRuleCorpusUnicornNoInvalidRemoveEventListener(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/no-invalid-remove-event-listener.ts", "declare const el: EventTarget;\n// expect: unicorn/no-invalid-remove-event-listener error\nel.removeEventListener(\"click\", () => {});\n")
}
