package transformer

import (
  "strings"
  "testing"
)

// TestTransformGoUpper verifies the uppercase fixture operation.
//
// The reusable Go transformer fixture rewrites the synthetic goUpper call
// before TypeScript output is consumed by higher-level feature tests. This
// baseline keeps the primary operation observable at the package boundary.
//
// 1. Transform a source file containing one goUpper call.
// 2. Apply the explicit go-uppercase plugin operation.
// 3. Assert the emitted code contains the uppercased string literal.
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
