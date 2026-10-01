package linthost

import "testing"

// TestEngineTextRendersVerbatim verifies the printer copies Text fragments
// byte-for-byte to the output.
//
// The Text doc kind is the engine's escape hatch for content that must
// not be reflowed (already-formatted child slices, string literals with
// preserved escapes, etc.). A regression here would silently mangle
// every per-node printer that emits verbatim ranges, so the case pins
// the contract on a stand-alone fragment with whitespace and
// punctuation that resembles other doc kinds.
//
//  1. Build a single-Text doc whose payload contains spaces, a comma,
//     and a UTF-8 character.
//  2. Print under default options.
//  3. Assert the result equals the original byte sequence.
//
// @evidence contracts/testing.md#behavioral-verification Print must retain the exact Text payload including whitespace, comma and UTF-8 bytes.
// @evidence contracts/testing.md#independent-expectations Text is a verbatim leaf; the independently written input string is the expected output without layout computation.
// @evidence contracts/testing.md#distinguishing-cases A standalone payload covers the identity branch; embedded-newline Text is covered separately.
// @evidence contracts/testing.md#execution-ownership TestEngineTextRendersVerbatim is one Go unit entry that renders a single literal Text with Print under default options in-process; it parses no source and installs, builds and launches nothing.
func TestEngineTextRendersVerbatim(t *testing.T) {
  got := Print(Text("foo, bar 한글"), DefaultPrintOptions())
  if got != "foo, bar 한글" {
    t.Fatalf("text render mismatch: %q", got)
  }
}
