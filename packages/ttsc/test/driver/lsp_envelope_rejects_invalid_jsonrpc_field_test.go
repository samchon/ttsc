package driver_test

import (
  "errors"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPEnvelopeRejectsInvalidJSONRPCField checks the decoder's nonempty
// version guard for "1.0" and its absent-version compatibility policy.
// It does not execute proxy dispatch, forwarding or an upstream response.
//
// The 2.0 protocol and deliberate absent-version compatibility policy ground opposite results.
//
//  1. Parse an envelope whose jsonrpc is "1.0".
//  2. Assert ErrInvalidJSONRPC is returned.
//  3. Parse an envelope with the field absent. should succeed (we stay
//     permissive for editors that omit jsonrpc).
//
// @evidence contracts/testing.md#behavioral-verification ParseEnvelope rejects version 1.0 but permits the absent field.
// @evidence contracts/testing.md#independent-expectations The 2.0 protocol and deliberate absent-version compatibility policy ground opposite results.
// @evidence contracts/testing.md#distinguishing-cases Wrong version contrasts with absent version; malformed JSON is separate.
// @evidence contracts/testing.md#execution-ownership Go test/driver invokes ParseEnvelope directly on authored bytes without filesystem inputs, shim operations or a transport process.
func TestLSPEnvelopeRejectsInvalidJSONRPCField(t *testing.T) {
  if _, err := driver.ParseEnvelope([]byte(`{"jsonrpc":"1.0","method":"x"}`)); !errors.Is(err, driver.ErrInvalidJSONRPC) {
    t.Fatalf("expected ErrInvalidJSONRPC, got %v", err)
  }
  if _, err := driver.ParseEnvelope([]byte(`{"method":"x"}`)); err != nil {
    t.Fatalf("absent jsonrpc field should be tolerated, got %v", err)
  }
}
