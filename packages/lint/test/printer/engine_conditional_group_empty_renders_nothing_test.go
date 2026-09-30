package linthost

import "testing"

// TestEngineConditionalGroupEmptyRendersNothing verifies the engine
// treats an option-less ConditionalGroup as a layout no-op.
//
// A printer should never build an empty ConditionalGroup, but the
// engine's option loop reads `Children[len-1]` as the fallback; the
// length guard in front of it keeps a zero-option group from indexing
// out of range.
//
//  1. Build a ConditionalGroup with no options.
//  2. Print it.
//  3. Assert the output is empty.
//
// @evidence contracts/testing.md#behavioral-verification Print of an option-less ConditionalGroup must return an empty string without indexing a missing fallback.
// @evidence contracts/testing.md#independent-expectations The empty alternatives identity contributes no text in the Doc algebra.
// @evidence contracts/testing.md#distinguishing-cases Zero alternatives complements the first-fitting and last-fallback alternatives cases.
// @evidence contracts/testing.md#execution-ownership TestEngineConditionalGroupEmptyRendersNothing is a public Go unit entry selected with printer cases by TestSelectedLintUnits. It calls the Doc operation in the same Go test process, without a consumer install, native build or product host.
func TestEngineConditionalGroupEmptyRendersNothing(t *testing.T) {
  got := Print(ConditionalGroup(), DefaultPrintOptions())
  if got != "" {
    t.Fatalf("empty conditional group: want empty string, got %q", got)
  }
}
