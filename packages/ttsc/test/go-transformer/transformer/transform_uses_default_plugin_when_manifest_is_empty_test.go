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
//
// @evidence contracts/testing.md#behavioral-verification Transform selects uppercase for both nil and explicitly empty plugin manifests and emits a complete CommonJS module.
// @evidence contracts/testing.md#independent-expectations The literal HELLO module fixes default transformation and exports without consulting an emitted-output helper.
// @evidence contracts/testing.md#distinguishing-cases Nil and zero-length non-nil manifests cover both empty representations, while lower-case input rejects an omitted default operation.
// @evidence contracts/testing.md#execution-ownership Both representations reuse direct Transform calls in the same Go unit case; actual sidecar discovery and any E2E survival proof are outside this entry.
func TestTransformUsesDefaultPluginWhenManifestIsEmpty(t *testing.T) {
  result, err := Transform(`export const message: string = goUpper("hello");`, nil)
  if err != nil {
    t.Fatal(err)
  }
  if !strings.Contains(result.Code, `"HELLO"`) {
    t.Fatalf("expected default uppercase plugin, got:\n%s", result.Code)
  }

  want := "\"use strict\";\nObject.defineProperty(exports, \"__esModule\", { value: true });\nexports.message = void 0;\nconst message = \"HELLO\";\nexports.message = message;\n"
  if result.Code != want {
    t.Fatalf("nil-manifest output = %q, want %q", result.Code, want)
  }
  empty, err := Transform(`export const message: string = goUpper("hello");`, []Plugin{})
  if err != nil {
    t.Fatal(err)
  }
  if empty.Code != want {
    t.Fatalf("empty-manifest output = %q, want %q", empty.Code, want)
  }
}
