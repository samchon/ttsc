package driver_test

import (
  "encoding/json"
  "testing"
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
// @evidence contracts/testing.md#execution-ownership The existing linkname bridge calls the actual driver ID-key helper in Go. Go discovers TestLSPEnvelopeIDKeyRejectsInvalidJSON under ./test/driver.
func TestLSPEnvelopeIDKeyRejectsInvalidJSON(t *testing.T) {
  if got := driverIDKeyFromRaw(json.RawMessage(`{`)); got != "" {
    t.Fatalf("invalid id key mismatch: %q", got)
  }
}
