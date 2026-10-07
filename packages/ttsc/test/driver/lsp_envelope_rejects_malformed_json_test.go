package driver_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPEnvelopeRejectsMalformedJSON checks syntax rejection and the
// decoder operation name in the error text. It does not establish wrapped
// error identity or execute malformed-frame forwarding.
//
// 1. Pass non-JSON bytes to ParseEnvelope.
// 2. Assert an error mentioning "envelope" is returned.
//
// @evidence contracts/testing.md#behavioral-verification ParseEnvelope rejects non-JSON input and returns an error mentioning envelope.
// @evidence contracts/testing.md#independent-expectations The literal not json input cannot denote a JSON-RPC envelope, and the decoder error must name its operation.
// @evidence contracts/testing.md#distinguishing-cases This owns syntax failure; valid request and response classification are exercised by neighboring envelope cases.
// @evidence contracts/testing.md#execution-ownership Go test/driver directly calls the decoder with bytes; it does not exercise the proxy malformed-frame forwarding branch.
func TestLSPEnvelopeRejectsMalformedJSON(t *testing.T) {
  _, err := driver.ParseEnvelope([]byte("not json"))
  if err == nil {
    t.Fatal("expected envelope decode error")
  }
  if !strings.Contains(err.Error(), "envelope") {
    t.Fatalf("error should mention envelope: %v", err)
  }
}
