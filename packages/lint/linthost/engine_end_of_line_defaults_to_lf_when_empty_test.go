package linthost

import "testing"

// TestEngineEndOfLineDefaultsToLFWhenEmpty verifies that Print falls
// back to Unix LF line endings when EndOfLine is the empty string.
//
// With EndOfLine omitted, a Hardline between the two literal fragments must
// emit one LF and retain both fragments. This observes default output, not
// whether a particular normalization assignment inside Print executed.
//
// @evidence contracts/testing.md#behavioral-verification Print must retain both payloads and emit LF for an empty EndOfLine option.
// @evidence contracts/testing.md#independent-expectations The documented omitted-option default gives the literal a\nb separator.
// @evidence contracts/testing.md#distinguishing-cases The empty option complements the explicit crlf separator case.
// @evidence contracts/testing.md#execution-ownership TestEngineEndOfLineDefaultsToLFWhenEmpty is one Go unit entry that renders a Hardline-bearing Concat with Print and an empty EndOfLine in-process; it parses no source and installs, builds and launches nothing.
func TestEngineEndOfLineDefaultsToLFWhenEmpty(t *testing.T) {
  doc := Concat(Text("a"), Hardline(), Text("b"))
  opts := PrintOptions{PrintWidth: 80, TabWidth: 2} // EndOfLine intentionally empty
  got := Print(doc, opts)
  if got != "a\nb" {
    t.Fatalf("empty EndOfLine should default to lf, got %q", got)
  }
}
