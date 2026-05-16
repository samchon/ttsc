package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPEnvelopeParsesNotification covers the notification shape the
// proxy snoops for publishDiagnostics and didOpen/didChange. IDKey must
// be empty so the proxy never confuses a notification with a pending
// request id.
//
// 1. Decode a notification envelope with no id.
// 2. Assert IsNotification is true and the other predicates are false.
// 3. Assert IDKey returns the empty string.
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
