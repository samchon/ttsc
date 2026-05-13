package transformer

import (
  "strings"
  "testing"
)

// TestTransformUsesDefaultPluginWhenManifestIsEmpty verifies default behavior.
//
// Empty plugin manifests still exercise the transformer through its default
// uppercase operation. This keeps the fixture useful for minimal host tests
// that do not need a full descriptor payload.
//
// 1. Transform a source file with an empty plugin manifest.
// 2. Let the transformer select its default operation.
// 3. Assert the emitted code contains the uppercased string literal.
func TestTransformUsesDefaultPluginWhenManifestIsEmpty(t *testing.T) {
  result, err := Transform(`export const message: string = goUpper("hello");`, nil)
  if err != nil {
    t.Fatal(err)
  }
  if !strings.Contains(result.Code, `"HELLO"`) {
    t.Fatalf("expected default uppercase plugin, got:\n%s", result.Code)
  }
}
