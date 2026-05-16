package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPEnvelopeParsesRequest covers the request shape the proxy
// dispatches against: id + method + params. IDKey routes the id
// through json.Decoder.UseNumber() before formatting, so peers that
// pad their JSON with whitespace or use a different integer encoding
// (e.g. 42 vs 42.0) still produce the same correlator key.
//
// 1. Decode a request envelope.
// 2. Assert IsRequest is true and IsResponse / IsNotification are false.
// 3. Assert IDKey returns the canonical integer form ("42").
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
