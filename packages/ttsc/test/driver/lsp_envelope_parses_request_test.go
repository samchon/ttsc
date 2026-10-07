package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPEnvelopeParsesRequest Verifies the request shape the proxy
// dispatches against: id + method + params. The id here is padded with
// whitespace (`"id":  42 `), which must still yield the canonical key; other
// encodings of the same number (42.0, exponent forms) are covered by
// TestLSPEnvelopeIDKeyNormalizesEquivalentNumerics.
//
// 1. Decode a request envelope.
// 2. Assert IsRequest is true and IsResponse / IsNotification are false.
// 3. Assert IDKey returns the canonical integer form ("42").
//
// @evidence contracts/testing.md#behavioral-verification ParseEnvelope classifies the id-plus-method envelope only as a request, preserves initialize and canonicalizes the padded id to 42.
// @evidence contracts/testing.md#independent-expectations The authored JSON-RPC request has both id and method, so response and notification classifications must be false.
// @evidence contracts/testing.md#distinguishing-cases Whitespace around an integer id is covered here; alternate numeric encodings are covered by the equivalent-numerics case.
// @evidence contracts/testing.md#execution-ownership Go discovers the request-shape unit in test/driver and invokes the public envelope facade directly.
func TestLSPEnvelopeParsesRequest(t *testing.T) {
  body := []byte(`{"jsonrpc":"2.0","id":  42 ,"method":"initialize","params":{}}`)

  env, err := driver.ParseEnvelope(body)
  if err != nil {
    t.Fatalf("ParseEnvelope errored: %v", err)
  }
  if !env.IsRequest() {
    t.Fatalf("expected IsRequest, got envelope %+v", env)
  }
  if env.IsResponse() {
    t.Fatal("request envelope must not look like response")
  }
  if env.IsNotification() {
    t.Fatal("request envelope must not look like notification")
  }
  if env.IDKey() != "42" {
    t.Fatalf("IDKey mismatch: %q", env.IDKey())
  }
  if env.Method != "initialize" {
    t.Fatalf("method mismatch: %q", env.Method)
  }
}
