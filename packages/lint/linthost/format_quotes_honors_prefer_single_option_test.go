package linthost

import "testing"

// TestFormatQuotesHonorsPreferSingleOption verifies that the `prefer:
// "single"` option flips formatQuotes' direction.
//
// The default behavior converts single-quoted literals to double-quoted.
// Passing `{ prefer: "single" }` flips the contract: double-quoted
// literals convert to single-quoted (still subject to the escape-cost
// tie-breaker). This scenario locks the InlineRuleResolver options path
// end-to-end — JSON blob → DecodeOptions → behavioral switch — without
// touching the engine internals directly.
//
// 1. Parse a double-quoted literal with `prefer: "single"` configured.
// 2. Apply the rule's edits through the disk-backed fixer.
// 3. Assert the literal is now single-quoted.
//
// @evidence contracts/testing.md#behavioral-verification The inline resolver option prefer:single must make format/quotes convert the plain double-quoted hello while preserving its declaration and use.
// @evidence contracts/testing.md#independent-expectations The full output literal follows the configured single delimiter on a zero-escape tie and retains the hello value and JSON.stringify call.
// @evidence contracts/testing.md#distinguishing-cases This option-controlled positive complements the default-double positive; cost-minimization siblings distinguish when fewer escapes override the option.
// @evidence contracts/testing.md#execution-ownership TestFormatQuotesHonorsPreferSingleOption is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns its literal inputs and complete output assertions; the shared syntax-only harness invokes the owning rule and applies source edits in process without a consumer install, native product build or product host.
func TestFormatQuotesHonorsPreferSingleOption(t *testing.T) {
  source := "const greeting = \"hello\";\nJSON.stringify(greeting);\n"
  want := "const greeting = 'hello';\nJSON.stringify(greeting);\n"
  assertFixSnapshotWithOptions(t, "format/quotes", source, `{"prefer":"single"}`, want)
}
