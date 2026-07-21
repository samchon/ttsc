package driver_test

import (
  "path/filepath"
  "strings"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graphsymbols"
)

// TestRunLSPGraphSymbolsPreserveHashBearingPaths verifies graph LSP references:
// ids whose source path contains '#' still map back to the real source file.
//
// The graph producer escapes a hash inside the id's path component. The LSP
// provider must decode that component before comparing an edge to the editor's
// URI; otherwise every reference from the file is discarded as a different
// source path.
//
//  1. Build a project whose root, directory, and source filename contain '#'.
//  2. Warm the graph-backed provider and request references for `greet`.
//  3. Assert the declaration and usage from that exact file are returned.
func TestRunLSPGraphSymbolsPreserveHashBearingPaths(t *testing.T) {
  root := filepath.Join(t.TempDir(), "project#root")
  relative := "src#generated/main#file.ts"
  mainPath := filepath.Join(root, filepath.FromSlash(relative))
  writeGraphSymbolFile(t, filepath.Join(root, "tsconfig.json"), strings.Replace(graphSymbolTSConfig, "src/main.ts", relative, 1))
  writeGraphSymbolFile(t, mainPath, `export function greet(): void {}
export function use(): void { greet(); }
`)
  mainURI := fileURIForPath(mainPath)
  provider := graphsymbols.NewProvider(root, "tsconfig.json")
  if _, err := provider.DocumentSymbols(mainURI); err != nil {
    t.Fatalf("provider load failed: %v", err)
  }

  h := newProxyHarnessWithOptions(t, nil, driver.ProxyOptions{SymbolProvider: provider})
  h.sendEditor(symbolRequestBody(t, 1, "textDocument/references", map[string]any{
    "textDocument": map[string]any{"uri": mainURI},
    "position":     map[string]any{"line": 0, "character": 17},
    "context":      map[string]any{"includeDeclaration": true},
  }))
  var locations []driver.LSPLocation
  decodeResult(t, h.recvEditor(), &locations)
  h.expectNoUpstreamFrame(150 * time.Millisecond)
  if len(locations) != 2 {
    t.Fatalf("hash-bearing-path references = %d, want declaration and usage: %+v", len(locations), locations)
  }
  for _, location := range locations {
    if location.URI != mainURI {
      t.Fatalf("reference uri = %q, want %q", location.URI, mainURI)
    }
  }
}
