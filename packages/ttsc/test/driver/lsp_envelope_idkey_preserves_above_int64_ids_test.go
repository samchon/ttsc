package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPEnvelopeIDKeyPreservesAboveInt64IDs Verifies adjacent large integer identities
// for the two authored 19-digit ids. These adjacent values distinguish
// literal preservation from a rounded float representation. This is the
// decoder's compatibility key policy, not proof that above-int64 IDs meet
// LSP identifier constraints or that an actual proxy session correlates them.
//
//  1. Decode two envelopes whose integer ids differ only above the
//     safe-float boundary (9999999999999999998 vs 9999999999999999999).
//  2. Assert each IDKey returns the exact decimal literal so a
//     regression that returned distinct-but-arbitrary bytes (e.g.
//     hex.EncodeToString or a per-call counter) would still fail.
//  3. Decode a third envelope whose id is well below MaxInt64; assert it
//     canonicalises through the Int64 arm to its decimal form.
//
// @evidence contracts/testing.md#behavioral-verification ParseEnvelope and IDKey preserve each of two adjacent 19-digit integer literals and a small integer key exactly.
// @evidence contracts/testing.md#independent-expectations The compatibility policy preserves integer-shaped literals beyond int64; the two authored decimal strings and 42 independently specify exact keys, without certifying protocol validity.
// @evidence contracts/testing.md#distinguishing-cases Adjacent integers above int64 detect float collapse, while 42 checks the small-integer branch; exponent normalization belongs to its peer case.
// @evidence contracts/testing.md#execution-ownership The Go test/driver envelope unit decodes authored JSON and checks keys in process without an LSP session.
func TestLSPEnvelopeIDKeyPreservesAboveInt64IDs(t *testing.T) {
  a, err := driver.ParseEnvelope([]byte(`{"jsonrpc":"2.0","id":9999999999999999998,"method":"x"}`))
  if err != nil {
    t.Fatalf("a parse failed: %v", err)
  }
  b, err := driver.ParseEnvelope([]byte(`{"jsonrpc":"2.0","id":9999999999999999999,"method":"x"}`))
  if err != nil {
    t.Fatalf("b parse failed: %v", err)
  }
  // Inequality alone would not catch a regression that returned
  // distinct-but-arbitrary bytes; pin the literal contract directly.
  if got := a.IDKey(); got != "9999999999999999998" {
    t.Fatalf("a key mismatch: got %q want %q", got, "9999999999999999998")
  }
  if got := b.IDKey(); got != "9999999999999999999" {
    t.Fatalf("b key mismatch: got %q want %q", got, "9999999999999999999")
  }

  small, err := driver.ParseEnvelope([]byte(`{"jsonrpc":"2.0","id":42,"method":"x"}`))
  if err != nil {
    t.Fatalf("small parse failed: %v", err)
  }
  if got := small.IDKey(); got != "42" {
    t.Fatalf("expected small int key to canonicalise to %q, got %q", "42", got)
  }
}
