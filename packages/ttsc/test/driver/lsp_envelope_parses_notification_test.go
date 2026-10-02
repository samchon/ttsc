package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPEnvelopeParsesNotification Verifies the notification shape the
// proxy snoops for publishDiagnostics and didOpen/didChange. IDKey must
// be empty so the proxy never confuses a notification with a pending
// request id.
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
// @evidence contracts/testing.md#execution-ownership Go unit TestLSPEnvelopeParsesNotification is discovered by go test in test/driver and invokes source/shim operations directly. Temporary filesystem inputs do not install a consumer or build a host artifact.
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
