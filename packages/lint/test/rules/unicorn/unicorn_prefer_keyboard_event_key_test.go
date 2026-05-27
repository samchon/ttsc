package linthost

import "testing"

// TestRuleCorpusUnicornPreferKeyboardEventKey verifies the rule reports a
// `keyCode` property read on a declared KeyboardEvent.
//
// The rule matches purely on the right-hand identifier name of a property
// access; receivers are not type-checked, so a declared `KeyboardEvent`
// stand-in is the most legible positive shape and the canonical legacy
// pattern the rule exists to replace.
//
// 1. Enable unicorn/prefer-keyboard-event-key via an expect annotation.
// 2. Read `event.keyCode` from a declared KeyboardEvent binding.
// 3. Assert the property-access expression is reported.
func TestRuleCorpusUnicornPreferKeyboardEventKey(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/prefer-keyboard-event-key.ts", "declare const event: KeyboardEvent;\n// expect: unicorn/prefer-keyboard-event-key error\nvoid event.keyCode;\n")
}
