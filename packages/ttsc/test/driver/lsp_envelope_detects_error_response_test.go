package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPEnvelopeDetectsErrorResponse checks the decoder and failure-routing
// predicate directly, without executing proxy forwarding. The null-error
// fixture includes both result and error, so it exercises the decoder's
// permissive routing view rather than a valid JSON-RPC success response.
//
// 1. Decode an error response. Assert IsErrorResponse is true.
// 2. Decode a response-shaped frame with null error. Assert it is false.
// 3. Decode a notification. Assert IsErrorResponse is false.
//
// @evidence contracts/testing.md#behavioral-verification ParseEnvelope and IsErrorResponse distinguish an error response from a response with null error and a notification.
// @evidence contracts/testing.md#independent-expectations Authored ID/method fields and error-object versus null payloads supply literal expectations for the failure-routing predicate; the null-error frame does not establish result/error exclusivity or protocol validity.
// @evidence contracts/testing.md#distinguishing-cases A real error object returns true; null error and no-response-id notification return false.
// @evidence contracts/testing.md#execution-ownership Go test/driver directly calls the envelope decoder and predicate without a transport or native process.
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
