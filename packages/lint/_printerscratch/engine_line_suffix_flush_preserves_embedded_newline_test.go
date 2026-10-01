package linthost

import "testing"

// Verifies suffix flushing preserves multiline payloads before the triggering break.
//
// A queued suffix containing a newline must remain before the requested Hardline and the following b. The output assertion observes payload and break order; Hardline resets column state, so it does not isolate the preceding column tracker.
//
// 1. Queue x\ny after a, then request a Hardline and b.
// 2. Print and assert the exact ax\ny\nb output.
//
// @evidence contracts/testing.md#behavioral-verification Print must preserve x\ny before the following Hardline and retain the subsequent b.
// @evidence contracts/testing.md#independent-expectations The independently authored ax\ny\nb requires suffix order and verbatim payload. Hardline resets column state, so the assertion does not isolate the preceding tracker.
// @evidence contracts/testing.md#distinguishing-cases Multiline payload with a following break complements multiline final draining and ordinary single-line suffix flushing.
// @evidence contracts/testing.md#execution-ownership TestEngineLineSuffixFlushPreservesEmbeddedNewline is a public Go unit entry selected with printer cases by TestSelectedLintUnits. It calls the Doc operation in the same Go test process, without a consumer install, native build or product host.
func TestEngineLineSuffixFlushPreservesEmbeddedNewline(t *testing.T) {
  doc := Concat(
    Text("a"),
    LineSuffix(Text("x\ny")),
    Hardline(),
    Text("b"),
  )
  got := Print(doc, DefaultPrintOptions())
  if got != "ax\ny\nb" {
    t.Fatalf("line-suffix embedded-newline mismatch: %q", got)
  }
}
