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
//
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule runs on the idempotent on first hugged call fixture and must report no findings, rejecting an unnecessary or unsafe edit rather than only comparing two formatter outputs. The owned result is: Assert the rule reports nothing.
// @evidence contracts/testing.md#independent-expectations The literal unchanged input and zero-finding expectation follow the preservation boundary described above, independently of printer output. This host proves abstention, while changing fixtures in sibling rule tests prove formatting correctness.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Parse an already first-hugged call (printWidth 40). The asserted decision is: Assert the rule reports nothing. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthIdempotentOnFirstHuggedCall is one Go unit entry through the fixture parser and rule engine; its zero-findings assertion uses no installed consumer, formatter subprocess or native build.
func TestFormatPrintWidthIdempotentOnFirstHuggedCall(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/print-width",
    "onUnmounted(() => {\n  cleanupTheThing();\n  resetAll();\n}, target);\n",
    `{"printWidth":40,"tabWidth":2}`,
  )
}
