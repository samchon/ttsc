// Unit tests for the reusable Go transformer fixture.
//
// The assertions pin the fixture's observable transform contract: default
// operation inference, ordered plugin descriptor application, validation
// failures, and non-string config fallback.
package transformer

import (
  "strings"
  "testing"
)

func TestTransformGoUpper(t *testing.T) {
  result, err := Transform(`export const message: string = goUpper("hello"); console.log(message);`, []Plugin{
    {Operation: "go-uppercase"},
  })
  if err != nil {
    t.Fatal(err)
  }
  if !strings.Contains(result.Code, `"HELLO"`) {
    t.Fatalf("expected transformed literal, got:\n%s", result.Code)
  }
}

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

func TestTransformUsesDefaultPluginWhenManifestIsEmpty(t *testing.T) {
  result, err := Transform(`export const message: string = goUpper("hello");`, nil)
  if err != nil {
    t.Fatal(err)
  }
  if !strings.Contains(result.Code, `"HELLO"`) {
    t.Fatalf("expected default uppercase plugin, got:\n%s", result.Code)
  }
}

func TestTransformReportsInvalidSourceAndOperation(t *testing.T) {
  if _, err := Transform(`export const message = "hello";`, nil); err == nil {
    t.Fatal("missing goUpper call must fail")
  }
  if _, err := Transform(`export const message: string = goUpper("hello");`, []Plugin{
    {Operation: "go-reverse"},
  }); err == nil || !strings.Contains(err.Error(), "unsupported operation") {
    t.Fatalf("unsupported operation error mismatch: %v", err)
  }
}

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
