package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPEnvelopeIDKeyPreservesAboveInt64IDs pins the round-4 fix that
// keeps distinct 19+ digit ids distinct. The previous Float64-fallback
// normalization rounded any id past 2^53 down to `1e+19`, colliding
// every "huge integer" id into the same pending-actions key — a real
// proxy correctness bug for peers that mint ids from a counter past
// MaxInt64.
//
//  1. Decode two envelopes whose integer ids differ only above the
//     safe-float boundary (9999999999999999998 vs 9999999999999999999).
//  2. Assert each IDKey returns the exact decimal literal so a
//     regression that returned distinct-but-arbitrary bytes (e.g.
//     hex.EncodeToString or a per-call counter) would still fail.
//  3. Decode a third envelope whose id is well below MaxInt64; assert it
//     canonicalises through the Int64 arm to its decimal form.
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
