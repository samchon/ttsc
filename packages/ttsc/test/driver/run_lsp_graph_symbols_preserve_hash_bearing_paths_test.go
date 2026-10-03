package driver_test

import (
  "path/filepath"
  "strings"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graphsymbols"
)

// TestRunLSPGraphSymbolsPreserveHashBearingPaths Verifies that graph references from hash-bearing paths return two locations with the exact file URI.
//
// Root, directory, and filename contain hashes; distinct declaration and usage ranges are not asserted.
//
// 1. Write a project with hashes in its root, directory, and source name.
// 2. Warm the provider and request greet references through the local proxy route.
// 3. Assert two locations both carry the exact authored file URI.
//
// @evidence contracts/testing.md#behavioral-verification Graph references from hash-bearing paths return two locations with the exact file URI.
// @evidence contracts/testing.md#independent-expectations The authored declaration and usage define count and URI independently of graph ID parsing.
// @evidence contracts/testing.md#distinguishing-cases Root, directory, and filename contain hashes; distinct declaration and usage ranges are not asserted.
// @evidence contracts/testing.md#execution-ownership The Go provider is warmed directly and queried through the in-process proxy, without a native producer. Go discovers TestRunLSPGraphSymbolsPreserveHashBearingPaths under ./test/driver.
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
