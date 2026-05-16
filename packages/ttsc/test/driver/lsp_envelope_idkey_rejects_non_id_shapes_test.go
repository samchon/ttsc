package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPEnvelopeIDKeyRejectsNonIDShapes pins the empty-key
// fall-through for JSON shapes LSP does not allow as request ids
// (boolean, null, array, object). The proxy's pending-map callers
// treat an empty key as "no entry" — this test pins the *helper* half
// of that contract; the proxy-side use of the empty key is covered by
// the cancel-id tests.
//
// 1. Parse envelopes whose id field is each non-id shape.
// 2. Assert IDKey returns the empty string for every case.
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
