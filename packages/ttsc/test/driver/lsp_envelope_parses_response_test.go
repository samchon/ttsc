package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPEnvelopeParsesResponse Verifies that ParseEnvelope identifies a string-ID response and preserves the quoted abc key and raw empty-array result.
//
// This response case covers a string ID and empty result, not numeric normalization.
//
// 1. Decode a response envelope with a string id.
// 2. Assert IsResponse is true.
// 3. Assert IDKey is the quoted string literal (`"abc"`) and Result is the raw `[]`.
//
// @evidence contracts/testing.md#behavioral-verification ParseEnvelope identifies a string-ID response and preserves the quoted abc key and raw empty-array result.
// @evidence contracts/testing.md#independent-expectations The input has an ID but no method, and string identity must remain distinct from numeric identity.
// @evidence contracts/testing.md#distinguishing-cases This response case covers a string ID and empty result, not numeric normalization.
// @evidence contracts/testing.md#execution-ownership The public parser and predicates operate directly on literal JSON in Go. Go discovers TestLSPEnvelopeParsesResponse under ./test/driver.
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
