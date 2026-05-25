package linthost

import (
  "path/filepath"
  "testing"
)

// TestFilePathFromURIPreservesLiteralPercentEscapes verifies file URI decoding
// happens exactly once.
//
// `url.Parse` already decodes `%25` to a literal percent in URL paths. A second
// unescape would turn a real filename segment like `a%20b.ts` into `a b.ts`,
// making LSP diagnostics and code actions miss files that contain percent
// escapes in their names.
//
// 1. Build a file URI whose encoded path segment is `a%2520b.ts`.
// 2. Convert it through the LSP URI helper.
// 3. Assert the resolved path still names `a%20b.ts`.
func TestFilePathFromURIPreservesLiteralPercentEscapes(t *testing.T) {
  got, err := filePathFromURI("file:///tmp/ttsc-lsp/a%2520b.ts")
  if err != nil {
    t.Fatal(err)
  }
  want, err := filepath.Abs("/tmp/ttsc-lsp/a%20b.ts")
  if err != nil {
    t.Fatal(err)
  }
  if got != want {
    t.Fatalf("file path mismatch: want %q, got %q", want, got)
  }
}
