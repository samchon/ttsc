package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPEnvelopeIDKeyRejectsNonIDShapes Verifies that ParseEnvelope and IDKey reject boolean, null, array, and object IDs as empty keys.
//
// Named rows distinguish four unsupported shapes; valid IDs execute in sibling tests.
//
// 1. Parse envelopes whose id field is each non-id shape.
// 2. Assert IDKey returns the empty string for every case.
//
// @evidence contracts/testing.md#behavioral-verification ParseEnvelope and IDKey reject boolean, null, array, and object IDs as empty keys.
// @evidence contracts/testing.md#independent-expectations JSON-RPC IDs accept numeric or string shapes, unlike the four authored rows.
// @evidence contracts/testing.md#distinguishing-cases Named rows distinguish four unsupported shapes; valid IDs execute in sibling tests.
// @evidence contracts/testing.md#execution-ownership Each t.Run row directly calls the Go envelope operations without a proxy session. Go discovers TestLSPEnvelopeIDKeyRejectsNonIDShapes under ./test/driver.
func TestLSPEnvelopeIDKeyRejectsNonIDShapes(t *testing.T) {
  cases := []struct {
    name string
    body string
  }{
    {"boolean", `{"jsonrpc":"2.0","id":true,"method":"x"}`},
    {"null", `{"jsonrpc":"2.0","id":null,"method":"x"}`},
    {"array", `{"jsonrpc":"2.0","id":[1],"method":"x"}`},
    {"object", `{"jsonrpc":"2.0","id":{"k":1},"method":"x"}`},
  }
  for _, tc := range cases {
    t.Run(tc.name, func(t *testing.T) {
      env, err := driver.ParseEnvelope([]byte(tc.body))
      if err != nil {
        t.Fatalf("parse failed: %v", err)
      }
      if got := env.IDKey(); got != "" {
        t.Fatalf("expected empty key for %s id, got %q", tc.name, got)
      }
    })
  }
}
