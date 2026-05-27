package linthost

import "testing"

// TestRuleCorpusUnicornPreferAddEventListener verifies the rule reports an
// `el.onclick = …` style handler assignment.
//
// The rule's single positive branch matches a property-access LHS whose
// property name is `on<lower>...`. `el.onclick = () => {}` is the canonical
// DOM-handler-overwrite shape and the only one the rule rewrites, so the
// fixture pins it directly.
//
// 1. Enable unicorn/prefer-add-event-listener via an expect annotation.
// 2. Assign an arrow function to `el.onclick` on a declared element shim.
// 3. Assert the assignment expression is reported.
func TestRuleCorpusUnicornPreferAddEventListener(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/prefer-add-event-listener.ts", "declare const el: { onclick: any };\n// expect: unicorn/prefer-add-event-listener error\nel.onclick = () => {};\n")
}
