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
func TestFormatQuotesHonorsPreferSingleOption(t *testing.T) {
  source := "const greeting = \"hello\";\nJSON.stringify(greeting);\n"
  want := "const greeting = 'hello';\nJSON.stringify(greeting);\n"
  assertFixSnapshotWithOptions(t, "format/quotes", source, `{"prefer":"single"}`, want)
}
