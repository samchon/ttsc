package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPEnvelopeParsesResponse covers the response shape the proxy uses
// to match upstream code-action responses against the remembered request
// payload. A response has id but no method; result holds the JSON-RPC
// result value. A string id is keyed as its quoted literal, which differs from
// the unquoted key a numeric id gets (the numeric side is not decoded here).
//
// 1. Decode a response envelope with a string id.
// 2. Assert IsResponse is true.
// 3. Assert IDKey is the quoted string literal (`"abc"`) and Result is the
//    raw `[]`.
func TestLSPEnvelopeParsesResponse(t *testing.T) {
  body := []byte(`{"jsonrpc":"2.0","id":"abc","result":[]}`)

  env, err := driver.ParseEnvelope(body)
  if err != nil {
    t.Fatalf("ParseEnvelope errored: %v", err)
  }
  if !env.IsResponse() {
    t.Fatalf("expected response, got %+v", env)
  }
  if env.IDKey() != `"abc"` {
    t.Fatalf("IDKey mismatch: %q", env.IDKey())
  }
  if string(env.Result) != "[]" {
    t.Fatalf("result mismatch: %q", env.Result)
  }
}
