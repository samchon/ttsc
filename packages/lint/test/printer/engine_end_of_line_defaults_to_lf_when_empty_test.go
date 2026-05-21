package linthost

import "testing"

// TestEngineEndOfLineDefaultsToLFWhenEmpty verifies that Print falls
// back to Unix LF line endings when EndOfLine is the empty string.
//
// Callers that zero-initialise PrintOptions get an empty EndOfLine.
// Without the guard the engine would write a bare "\n" (the zero value
// of newline) anyway, but the guard makes the contract explicit: empty
// means LF. This test pins that branch so a future refactor that
// conditionalises on EndOfLine without the guard cannot silently shift
// to CRLF or an empty separator on default-constructed options.
//
//  1. Build Group(Text("a"), Hardline(), Text("b")).
//  2. Print with EndOfLine="" (empty string).
//  3. Assert the newline separator is bare "\n" (LF), confirming the
//     engine applied the lf default.
func TestEngineEndOfLineDefaultsToLFWhenEmpty(t *testing.T) {
  doc := Concat(Text("a"), Hardline(), Text("b"))
  opts := PrintOptions{PrintWidth: 80, TabWidth: 2} // EndOfLine intentionally empty
  got := Print(doc, opts)
  if got != "a\nb" {
    t.Fatalf("empty EndOfLine should default to lf, got %q", got)
  }
}
