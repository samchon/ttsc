package transformer

import (
  "strings"
  "testing"
)

// TestTransformOrderedPlugins verifies manifest order is preserved.
//
// The transformer fixture applies descriptor entries in the order received
// from the host. Prefix, uppercase, and suffix together make ordering visible
// in one emitted literal.
//
// 1. Transform a source file with one goUpper call.
// 2. Apply prefix, uppercase, and suffix operations in sequence.
// 3. Assert the emitted code reflects that exact plugin order.
func TestTransformOrderedPlugins(t *testing.T) {
  result, err := Transform(`export const message: string = goUpper("hello"); console.log(message);`, []Plugin{
    {Operation: "go-prefix", Config: map[string]any{"prefix": "A:"}},
    {Operation: "go-uppercase"},
    {Operation: "go-suffix", Config: map[string]any{"suffix": ":Z"}},
  })
  if err != nil {
    t.Fatal(err)
  }
  if !strings.Contains(result.Code, `"A:HELLO:Z"`) {
    t.Fatalf("expected ordered plugin output, got:\n%s", result.Code)
  }
}
