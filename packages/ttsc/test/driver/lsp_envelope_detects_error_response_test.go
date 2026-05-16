package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPEnvelopeDetectsErrorResponse pins the IsErrorResponse predicate
// the proxy uses to skip merging plugin contributions into upstream
// failures. JSON-RPC §5.1 forbids both `result` and `error` on the
// same frame; an unmerged forward keeps the editor's view consistent
// with what tsgo actually said.
//
// 1. Decode an error response. Assert IsErrorResponse is true.
// 2. Decode a success response with null error. Assert it is false.
// 3. Decode a notification. Assert IsErrorResponse is false.
func TestLSPEnvelopeDetectsErrorResponse(t *testing.T) {
  errResp, err := driver.ParseEnvelope([]byte(`{"jsonrpc":"2.0","id":9,"error":{"code":-1,"message":"boom"}}`))
  if err != nil {
    t.Fatal(err)
  }
  if !errResp.IsErrorResponse() {
    t.Fatalf("expected error response, got %+v", errResp)
  }

  okResp, err := driver.ParseEnvelope([]byte(`{"jsonrpc":"2.0","id":9,"result":null,"error":null}`))
  if err != nil {
    t.Fatal(err)
  }
  if okResp.IsErrorResponse() {
    t.Fatalf("null error should not be an error response: %+v", okResp)
  }

  notif, err := driver.ParseEnvelope([]byte(`{"jsonrpc":"2.0","method":"x"}`))
  if err != nil {
    t.Fatal(err)
  }
  if notif.IsErrorResponse() {
    t.Fatalf("notification should not be an error response: %+v", notif)
  }
}
