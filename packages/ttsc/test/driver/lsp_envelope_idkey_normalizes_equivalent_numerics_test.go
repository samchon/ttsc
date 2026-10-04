package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPEnvelopeIDKeyNormalizesEquivalentNumerics Verifies four
// behavior groups in IDKey's numeric path for the authored decimal and
// exponent forms. It does not establish exact equivalence for arbitrary
// decimals, protocol validity of fractional IDs or proxy transport behavior.
//
// Literal numeric equality grounds keys 1, 1.5 and 100.
//
// 1. Parse ids 1 and 1.0 and require the same literal key 1.
// 2. Parse fractional id 1.5 and keep that key.
// 3. Parse lower/uppercase exponent forms of 1 and require key 1.
// 4. Compare exponent id 1e2 with decimal id 100.
//
// @evidence contracts/testing.md#behavioral-verification ParseEnvelope and IDKey normalize integer-valued forms and retain 1.5.
// @evidence contracts/testing.md#independent-expectations Literal numeric equality grounds keys 1, 1.5 and 100.
// @evidence contracts/testing.md#distinguishing-cases Decimal, fractional, lowercase/uppercase exponent and exponent/integer equality differ.
// @evidence contracts/testing.md#execution-ownership Go test/driver directly invokes ParseEnvelope and IDKey on authored bytes, without filesystem inputs, shim operations or a transport process.
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
  // collapse to "1" under the key policy. A refactor that flipped the `.eE`
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
  if hundredFloat.IDKey() != "100" || hundredInt.IDKey() != "100" ||
    hundredFloat.IDKey() != hundredInt.IDKey() {
    t.Fatalf("1e2 and 100 must collide: got %q vs %q", hundredFloat.IDKey(), hundredInt.IDKey())
  }
}
