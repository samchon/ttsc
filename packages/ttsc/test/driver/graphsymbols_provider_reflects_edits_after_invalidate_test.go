package driver_test

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/graphsymbols"
)

// TestGraphSymbolsProviderReflectsEditsAfterInvalidate Verifies the graph
// SymbolProvider rebuilds after Invalidate so a long-lived editor session does
// not freeze at the first request's snapshot, and that it never surfaces the
// per-file module node whose name is the file path.
//
// The provider caches its compiler load; the proxy calls Invalidate on
// didChange/didSave. Without the rebuild the second request would return the
// pre-edit forest forever, and without skipping the module node the outline
// would carry an absolute path as a Variable symbol.
//
// 1. Build a project declaring only alpha and read its documentSymbols.
// 2. Rewrite the file on disk to add beta before alpha, then Invalidate.
// 3. Assert the second read contains both names and no name looks like a path.
//
// @evidence contracts/testing.md#behavioral-verification DocumentSymbols before and after Provider.Invalidate must expose alpha, add beta only after the edit, and omit names containing path separators.
// @evidence contracts/testing.md#independent-expectations The two authored source texts establish which declarations exist in each generation; symbol-name checks do not assert the claimed movement of alpha ranges.
// @evidence contracts/testing.md#distinguishing-cases A first read excludes beta, an edited read includes both names, and both reads reject path-shaped module names.
// @evidence contracts/testing.md#execution-ownership The graphsymbols provider unit in Go test/driver compiles temporary source directly, without an editor or upstream LSP process.
func TestGraphSymbolsProviderReflectsEditsAfterInvalidate(t *testing.T) {
  root, mainURI := writeGraphSymbolProject(t, "export const alpha = 1;\n")
  mainPath := filepath.Join(root, "src", "main.ts")
  provider := graphsymbols.NewProvider(root, "tsconfig.json")

  first, err := provider.DocumentSymbols(mainURI)
  if err != nil {
    t.Fatalf("first DocumentSymbols: %v", err)
  }
  if !symbolTreeHasName(first, "alpha") {
    t.Fatalf("first read missing alpha: %+v", first)
  }
  if symbolTreeHasName(first, "beta") {
    t.Fatalf("beta present before the edit: %+v", first)
  }
  assertNoPathSeparatorSymbolNames(t, first)

  // Edit the file on disk between the two calls: add beta above alpha.
  writeGraphSymbolFile(t, mainPath, "export const beta = 2;\nexport const alpha = 1;\n")

  // The proxy invalidates on didChange/didSave; without this the cached pre-edit
  // graph would answer the next request.
  provider.Invalidate()

  second, err := provider.DocumentSymbols(mainURI)
  if err != nil {
    t.Fatalf("second DocumentSymbols: %v", err)
  }
  if !symbolTreeHasName(second, "beta") {
    t.Fatalf("edit not reflected after Invalidate; beta missing: %+v", second)
  }
  if !symbolTreeHasName(second, "alpha") {
    t.Fatalf("alpha missing after the edit: %+v", second)
  }
  assertNoPathSeparatorSymbolNames(t, second)
}
