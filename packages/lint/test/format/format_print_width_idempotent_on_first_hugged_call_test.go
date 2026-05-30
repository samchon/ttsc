package linthost

import "testing"

// TestFormatPrintWidthIdempotentOnFirstHuggedCall verifies the printer
// reproduces an already first-hugged call byte-for-byte so the cascade
// converges.
//
// Re-rendering the hugged shape must equal the source; otherwise the
// "no diff -> no edit" invariant breaks. Pins the round-trip for
// first-argument hugging.
//
//  1. Parse an already first-hugged call (printWidth 40).
//  2. Run format/print-width.
//  3. Assert the rule reports nothing.
func TestFormatPrintWidthIdempotentOnFirstHuggedCall(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/print-width",
    "onUnmounted(() => {\n  cleanupTheThing();\n  resetAll();\n}, target);\n",
    `{"printWidth":40,"tabWidth":2}`,
  )
}
