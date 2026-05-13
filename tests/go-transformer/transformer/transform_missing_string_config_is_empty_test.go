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
}
