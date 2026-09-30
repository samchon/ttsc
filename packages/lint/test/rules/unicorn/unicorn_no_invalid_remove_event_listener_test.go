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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies removeEventListener receives a newly allocated arrow callback; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-invalid-remove-event-listener annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; removeEventListener receives an existing callback identity. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoInvalidRemoveEventListener is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoInvalidRemoveEventListener(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-invalid-remove-event-listener.ts", "declare const el: EventTarget;\n// expect: unicorn/no-invalid-remove-event-listener error\nel.removeEventListener(\"click\", () => {});\n")
  assertRuleSkipsSource(t, "unicorn/no-invalid-remove-event-listener", "declare const el: EventTarget; const handler = () => {}; el.removeEventListener(\"click\", handler);\n")
}
