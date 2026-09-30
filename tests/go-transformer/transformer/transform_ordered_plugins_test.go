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
//
// @evidence contracts/testing.md#behavioral-verification Transform applies prefix, uppercase and suffix operations in received order and emits their result with the original binding.
// @evidence contracts/testing.md#independent-expectations Two complete literal modules require A:HELLO:z and a:HELLO:Z for contrasting operation orders; the original A:HELLO:Z assertion is retained.
// @evidence contracts/testing.md#distinguishing-cases Lower-case prefix and suffix make both sides of uppercase observable, unlike the original already-uppercase affixes; reversing the order must change the expected module.
// @evidence contracts/testing.md#execution-ownership Both order controls call the fixture Transform directly in one existing Go unit case, without preparing native plugins.
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

  source := `export const message: string = goUpper("hello");`
  for _, tc := range []struct { plugins []Plugin; want string }{
    {[]Plugin{{Operation:"go-prefix", Config:map[string]any{"prefix":"a:"}}, {Operation:"go-uppercase"}, {Operation:"go-suffix", Config:map[string]any{"suffix":":z"}}}, "\"use strict\";\nObject.defineProperty(exports, \"__esModule\", { value: true });\nexports.message = void 0;\nconst message = \"A:HELLO:z\";\nexports.message = message;\n"},
    {[]Plugin{{Operation:"go-suffix", Config:map[string]any{"suffix":":z"}}, {Operation:"go-uppercase"}, {Operation:"go-prefix", Config:map[string]any{"prefix":"a:"}}}, "\"use strict\";\nObject.defineProperty(exports, \"__esModule\", { value: true });\nexports.message = void 0;\nconst message = \"a:HELLO:Z\";\nexports.message = message;\n"},
  } {
    ordered, err := Transform(source, tc.plugins)
    if err != nil { t.Fatal(err) }
    if ordered.Code != tc.want { t.Fatalf("ordered output = %q, want %q", ordered.Code, tc.want) }
  }
}
