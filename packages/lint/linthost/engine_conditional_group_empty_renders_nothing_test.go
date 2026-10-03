package linthost

import "testing"

// TestEngineConditionalGroupEmptyRendersNothing verifies the engine
// treats an option-less ConditionalGroup as a layout no-op.
//
// Zero alternatives contribute no bytes. The length guard leaves an empty
// group inert instead of indexing a nonexistent final fallback.
//
//  1. Build a ConditionalGroup with no options.
//  2. Print it.
//  3. Assert the output is empty.
//
// @evidence contracts/testing.md#behavioral-verification Print of an option-less ConditionalGroup must return an empty string without indexing a missing fallback.
// @evidence contracts/testing.md#independent-expectations The empty alternatives identity contributes no text in the Doc algebra.
// @evidence contracts/testing.md#distinguishing-cases Zero alternatives complements the first-fitting and last-fallback alternatives cases.
// @evidence contracts/testing.md#execution-ownership TestEngineConditionalGroupEmptyRendersNothing is one Go unit entry that renders an option-less ConditionalGroup with Print in-process; it parses no source and installs, builds and launches nothing.
func TestEngineConditionalGroupEmptyRendersNothing(t *testing.T) {
  got := Print(ConditionalGroup(), DefaultPrintOptions())
  if got != "" {
    t.Fatalf("empty conditional group: want empty string, got %q", got)
  }
}
