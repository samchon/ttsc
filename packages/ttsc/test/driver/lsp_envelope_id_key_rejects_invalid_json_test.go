package driver_test

import (
  "encoding/json"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPEnvelopeIDKeyRejectsInvalidJSON Verifies that the raw ID normalizer returns an empty key for malformed JSON.
//
// Malformed syntax is distinct from unsupported but valid JSON shapes in other entries.
//
// 1. Pass malformed raw JSON to the id-key normalizer.
// 2. Assert it returns an empty key.
//
// @evidence contracts/testing.md#behavioral-verification The raw ID normalizer returns an empty key for malformed JSON.
// @evidence contracts/testing.md#independent-expectations The authored lone brace cannot represent a JSON-RPC ID.
// @evidence contracts/testing.md#distinguishing-cases Malformed syntax is distinct from unsupported but valid JSON shapes in other entries.
// @evidence contracts/testing.md#execution-ownership Go test/driver invokes the public Envelope.IDKey operation with an authored raw ID; its shared normalizer runs without a linkname bridge or proxy transport.
func TestLSPEnvelopeIDKeyRejectsInvalidJSON(t *testing.T) {
  env := driver.Envelope{ID: json.RawMessage(`{`)}
  if got := env.IDKey(); got != "" {
    t.Fatalf("invalid id key mismatch: %q", got)
  }
}
