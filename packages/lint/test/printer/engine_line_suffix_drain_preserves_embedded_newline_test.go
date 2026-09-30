package linthost

import "testing"

// Verifies final suffix draining preserves a multiline payload.
//
// The end-of-output drain must retain every payload byte even when no later break triggers normal flushing. This observes output preservation; the final internal column value is not exposed.
//
// 1. Build a with the queued suffix x\ny and no following break.
// 2. Print and assert the exact ax\ny output.
//
// @evidence contracts/testing.md#behavioral-verification Print must preserve the multiline suffix payload in ax\ny when draining at end-of-output.
// @evidence contracts/testing.md#independent-expectations Literal concatenation of a with x\ny establishes the full output independently. Internal final column state is not observable here.
// @evidence contracts/testing.md#distinguishing-cases The multiline final suffix complements the single-line drain and following-break flush.
// @evidence contracts/testing.md#execution-ownership TestEngineLineSuffixDrainPreservesEmbeddedNewline is a public Go unit entry selected with printer cases by TestSelectedLintUnits. It calls the Doc operation in the same Go test process, without a consumer install, native build or product host.
func TestEngineLineSuffixDrainPreservesEmbeddedNewline(t *testing.T) {
  doc := Concat(Text("a"), LineSuffix(Text("x\ny")))
  got := Print(doc, DefaultPrintOptions())
  if got != "ax\ny" {
    t.Fatalf("line-suffix drain newline-tracking mismatch: %q", got)
  }
}
