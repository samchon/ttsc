package transformer

import (
  "strings"
  "testing"
)

// TestTransformMissingStringConfigIsEmpty verifies non-string config fallback.
//
// Prefix and suffix operations read string values from plugin config. Missing
// values and non-string values are treated as empty strings so descriptor
// parsing remains tolerant.
//
// 1. Transform a source file with prefix and suffix operations.
// 2. Omit the prefix value and provide a non-string suffix value.
// 3. Assert the original literal remains unchanged.
//
// @evidence contracts/testing.md#behavioral-verification Transform treats absent prefix and numeric suffix options as empty while still rewriting the call into CommonJS.
// @evidence contracts/testing.md#independent-expectations The literal complete emitted module requires the original hello value and exact binding structure without deriving the expected value from Transform.
// @evidence contracts/testing.md#distinguishing-cases Absent versus numeric option values exercise separate fallback branches; exact output rejects merely returning the unchanged input that contains hello.
// @evidence contracts/testing.md#execution-ownership The existing Go unit process calls Transform with in-memory source and option maps, without native host setup.
func TestTransformMissingStringConfigIsEmpty(t *testing.T) {
  result, err := Transform(`export const message: string = goUpper("hello");`, []Plugin{
    {Operation: "go-prefix"},
    {Operation: "go-suffix", Config: map[string]any{"suffix": 123}},
  })
  if err != nil {
    t.Fatal(err)
  }
  if !strings.Contains(result.Code, `"hello"`) {
    t.Fatalf("non-string config values must behave as empty strings, got:\n%s", result.Code)
  }

  want := "\"use strict\";\nObject.defineProperty(exports, \"__esModule\", { value: true });\nexports.message = void 0;\nconst message = \"hello\";\nexports.message = message;\n"
  if result.Code != want { t.Fatalf("fallback output = %q, want %q", result.Code, want) }
}
