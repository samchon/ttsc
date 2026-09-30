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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies KeyboardEvent keyCode is used for keyboard identity; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-keyboard-event-key annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; KeyboardEvent key is used for keyboard identity. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferKeyboardEventKey is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferKeyboardEventKey(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-keyboard-event-key.ts", "declare const event: KeyboardEvent;\n// expect: unicorn/prefer-keyboard-event-key error\nvoid event.keyCode;\n")
  assertRuleSkipsSource(t, "unicorn/prefer-keyboard-event-key", "declare const event: KeyboardEvent; void event.key;\n")
}
