package driver_test

import (
  "strings"
  "sync"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// recordingSymbolProvider is a controllable driver.SymbolProvider for the proxy
// gating tests. It counts how often each method ran so a test can assert whether
// the proxy forwarded documentSymbol/references to upstream tsgo (the provider
// stays untouched) or answered them locally (the provider ran).
type recordingSymbolProvider struct {
  mu             sync.Mutex
  documentCalls  int
  referenceCalls int
  invalidations  int
  symbols        []driver.LSPDocumentSymbol
  locations      []driver.LSPLocation
}

func (r *recordingSymbolProvider) DocumentSymbols(string) ([]driver.LSPDocumentSymbol, error) {
  r.mu.Lock()
  defer r.mu.Unlock()
  r.documentCalls++
  return r.symbols, nil
}

func (r *recordingSymbolProvider) References(string, driver.LSPPosition, bool) ([]driver.LSPLocation, error) {
  r.mu.Lock()
  defer r.mu.Unlock()
  r.referenceCalls++
  return r.locations, nil
}

func (r *recordingSymbolProvider) Invalidate() {
  r.mu.Lock()
  defer r.mu.Unlock()
  r.invalidations++
}

func (r *recordingSymbolProvider) documentSymbolCallCount() int {
  r.mu.Lock()
  defer r.mu.Unlock()
  return r.documentCalls
}

func (r *recordingSymbolProvider) referenceCallCount() int {
  r.mu.Lock()
  defer r.mu.Unlock()
  return r.referenceCalls
}

func (r *recordingSymbolProvider) invalidationCount() int {
  r.mu.Lock()
  defer r.mu.Unlock()
  return r.invalidations
}

// symbolTreeHasName reports whether any symbol in the forest (at any depth) has
// the given name.
func symbolTreeHasName(symbols []driver.LSPDocumentSymbol, name string) bool {
  for _, s := range symbols {
    if s.Name == name || symbolTreeHasName(s.Children, name) {
      return true
    }
  }
  return false
}

// assertNoPathSeparatorSymbolNames fails when any symbol name (at any depth)
// contains a path separator. The graph's per-file module node carries the file
// path as its name; surfacing it would leak an absolute path into the outline,
// so no returned symbol may look like a path.
func assertNoPathSeparatorSymbolNames(t *testing.T, symbols []driver.LSPDocumentSymbol) {
  t.Helper()
  for _, s := range symbols {
    if strings.ContainsAny(s.Name, "/\\") {
      t.Fatalf("symbol name looks like a file path: %q", s.Name)
    }
    assertNoPathSeparatorSymbolNames(t, s.Children)
  }
}
