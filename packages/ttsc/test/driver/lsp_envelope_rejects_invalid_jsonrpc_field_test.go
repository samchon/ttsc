package driver_test

import (
  "errors"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPEnvelopeRejectsInvalidJSONRPCField pins the protocol guard
// added in round 1. A body that declares a `jsonrpc` field other than
// "2.0" is rejected so the proxy never dispatches malformed traffic
// — the pump forwards the original bytes verbatim to upstream so the
// peer can produce its own JSON-RPC error response.
//
//  1. Parse an envelope whose jsonrpc is "1.0".
//  2. Assert ErrInvalidJSONRPC is returned.
//  3. Parse an envelope with the field absent — should succeed (we stay
//     permissive for editors that omit jsonrpc).
func TestLSPEnvelopeRejectsInvalidJSONRPCField(t *testing.T) {
  if _, err := driver.ParseEnvelope([]byte(`{"jsonrpc":"1.0","method":"x"}`)); !errors.Is(err, driver.ErrInvalidJSONRPC) {
    t.Fatalf("expected ErrInvalidJSONRPC, got %v", err)
  }
  if _, err := driver.ParseEnvelope([]byte(`{"method":"x"}`)); err != nil {
    t.Fatalf("absent jsonrpc field should be tolerated, got %v", err)
  }
}
