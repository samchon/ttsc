package driver_test

import (
  "encoding/json"
  "testing"
)

// TestLSPEnvelopeIDKeyRejectsInvalidJSON verifies that LSP id keys reject
// undecodable raw JSON.
//
// JSON-RPC ids are normalized before the proxy indexes pending requests. A raw
// malformed value must produce the same empty key as unsupported id types so
// cancellation handling cannot delete an unrelated request.
//
// 1. Pass malformed raw JSON to the id-key normalizer.
// 2. Assert it returns an empty key.
func TestLSPEnvelopeIDKeyRejectsInvalidJSON(t *testing.T) {
  if got := driverIDKeyFromRaw(json.RawMessage(`{`)); got != "" {
    t.Fatalf("invalid id key mismatch: %q", got)
  }
}
