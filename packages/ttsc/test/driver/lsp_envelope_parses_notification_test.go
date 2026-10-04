package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPEnvelopeParsesNotification checks the no-ID didOpen routing shape
// and empty key directly. It does not execute proxy notification handling
// or pending-request correlation.
//
// JSON-RPC notifications have a method without a correlation id.
//
// 1. Decode a notification envelope with no id.
// 2. Assert IsNotification is true and the other predicates are false.
// 3. Assert IDKey returns the empty string.
//
// @evidence contracts/testing.md#behavioral-verification ParseEnvelope classifies no-id didOpen as notification only with empty key.
// @evidence contracts/testing.md#independent-expectations JSON-RPC notifications have a method without a correlation id.
// @evidence contracts/testing.md#distinguishing-cases One valid notification checks all three predicates; request/response matrices are separate.
// @evidence contracts/testing.md#execution-ownership Go test/driver invokes ParseEnvelope, routing predicates and IDKey on literal JSON without filesystem inputs, shim operations or a proxy transport.
func TestLSPEnvelopeParsesNotification(t *testing.T) {
  body := []byte(`{"jsonrpc":"2.0","method":"textDocument/didOpen","params":{}}`)

  env, err := driver.ParseEnvelope(body)
  if err != nil {
    t.Fatalf("ParseEnvelope errored: %v", err)
  }
  if !env.IsNotification() {
    t.Fatalf("expected notification, got %+v", env)
  }
  if env.IsRequest() || env.IsResponse() {
    t.Fatal("notification must not look like request/response")
  }
  if env.IDKey() != "" {
    t.Fatalf("IDKey for notification should be empty, got %q", env.IDKey())
  }
}
