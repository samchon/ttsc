package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPEnvelopeIDKeyNormalizesEquivalentNumerics covers four
// behavior groups in IDKey's numeric path so the proxy correlates ids
// regardless of how the peer formatted them on the wire:
//
//  1. Integer-shape and integer-valued float collapse to the same
//     canonical decimal (`1` vs `1.0` → "1").
//  2. Non-integer floats keep their literal form (`1.5` → "1.5").
//  3. Exponent-form integer-valued literals collapse to the canonical
//     decimal (`1e0`, `1E0`, `1.0E0` → "1"), defending the
//     `strings.ContainsAny(".eE")` discriminator against an
//     accidental lowercase-only refactor.
//  4. Float→integer collapse: `1e2` and `100` produce the same key,
//     pinning the float-shape safe-range integer-collapse branch.
func TestLSPEnvelopeIDKeyNormalizesEquivalentNumerics(t *testing.T) {
  intEnv, err := driver.ParseEnvelope([]byte(`{"jsonrpc":"2.0","id":1,"method":"ping"}`))
  if err != nil {
    t.Fatalf("int parse failed: %v", err)
  }
  floatEnv, err := driver.ParseEnvelope([]byte(`{"jsonrpc":"2.0","id": 1.0 ,"method":"ping"}`))
  if err != nil {
    t.Fatalf("float parse failed: %v", err)
  }
  if intEnv.IDKey() != "1" || floatEnv.IDKey() != "1" {
    t.Fatalf("expected both keys == %q, got int=%q float=%q", "1", intEnv.IDKey(), floatEnv.IDKey())
  }

  nonIntEnv, err := driver.ParseEnvelope([]byte(`{"jsonrpc":"2.0","id":1.5,"method":"ping"}`))
  if err != nil {
    t.Fatalf("non-integer float parse failed: %v", err)
  }
  if got := nonIntEnv.IDKey(); got != "1.5" {
    t.Fatalf("expected non-integer float to format as %q, got %q", "1.5", got)
  }

  // Exponent-form integer literals (`1e0`, `1E0`, `1.0E0`) must also
  // collapse to "1". JSON.stringify in JavaScript peers commonly emits
  // exponent form for big magnitudes, and LSP places no encoding
  // restriction on numeric ids; a refactor that flipped the `.eE`
  // discriminator to `.e` would silently regress uppercase-E without
  // these pins.
  for _, src := range []string{
    `{"jsonrpc":"2.0","id":1e0,"method":"ping"}`,
    `{"jsonrpc":"2.0","id":1E0,"method":"ping"}`,
    `{"jsonrpc":"2.0","id":1.0E0,"method":"ping"}`,
  } {
    env, err := driver.ParseEnvelope([]byte(src))
    if err != nil {
      t.Fatalf("exponent parse failed for %q: %v", src, err)
    }
    if got := env.IDKey(); got != "1" {
      t.Fatalf("expected exponent form to collapse to %q, got %q (src %s)", "1", got, src)
    }
  }

  // Float-to-integer collapse: `1e2` (= 100) must hash the same as
  // `100`. Pins the float-shape safe-range integer-collapse branch.
  hundredFloat, err := driver.ParseEnvelope([]byte(`{"jsonrpc":"2.0","id":1e2,"method":"ping"}`))
  if err != nil {
    t.Fatalf("1e2 parse failed: %v", err)
  }
  hundredInt, err := driver.ParseEnvelope([]byte(`{"jsonrpc":"2.0","id":100,"method":"ping"}`))
  if err != nil {
    t.Fatalf("100 parse failed: %v", err)
  }
  if hundredFloat.IDKey() != hundredInt.IDKey() {
    t.Fatalf("1e2 and 100 must collide: got %q vs %q", hundredFloat.IDKey(), hundredInt.IDKey())
  }
}
