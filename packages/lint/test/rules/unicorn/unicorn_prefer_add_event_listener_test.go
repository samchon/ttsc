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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies an onclick assignment uses a single-handler property; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-add-event-listener annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; addEventListener registers the click callback. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferAddEventListener is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferAddEventListener(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-add-event-listener.ts", "declare const el: { onclick: any };\n// expect: unicorn/prefer-add-event-listener error\nel.onclick = () => {};\n")
  assertRuleSkipsSource(t, "unicorn/prefer-add-event-listener", "declare const el: Element; el.addEventListener(\"click\", () => {});\n")
}
