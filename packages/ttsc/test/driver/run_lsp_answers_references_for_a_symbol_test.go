package driver_test

import (
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graphsymbols"
)

// TestRunLSPAnswersReferencesForASymbol Verifies that when upstream tsgo has not
// advertised references (no initialize handshake here, so the proxy treats it as
// unsupported), ttscserver falls back to the local graph SymbolProvider and
// answers with the usage sites of the symbol under the cursor, honoring
// context.includeDeclaration. In the fixture greet() is declared on line 0 and
// called from Service.run on line 6.
//
// Authored source lines 0 and 6 establish reference locations independently of provider output.
//
// 1. Warm the local graph provider for the authored declaration and call.
// 2. Request references without the declaration and check call line 6.
// 3. Include the declaration and check source lines 0 and 6.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run returns call site alone or declaration plus call according to includeDeclaration.
// @evidence contracts/testing.md#independent-expectations Authored source lines 0 and 6 establish reference locations independently of provider output.
// @evidence contracts/testing.md#distinguishing-cases False/true includeDeclaration differ under local fallback; no-upstream observation lasts 150ms.
// @evidence contracts/testing.md#execution-ownership Go unit TestRunLSPAnswersReferencesForASymbol in test/driver invokes NewProxy and Proxy.Run on in-memory pipes with injected sources/providers. No installed editor, sidecar or upstream process is launched.
func TestRunLSPAnswersReferencesForASymbol(t *testing.T) {
  root, mainURI := writeGraphSymbolProject(t, graphSymbolMainTS)
  provider := graphsymbols.NewProvider(root, "tsconfig.json")
  // Warm the graph cache so the in-proxy handler answers within the harness's
  // frame timeout.
  if _, err := provider.DocumentSymbols(mainURI); err != nil {
    t.Fatalf("provider load failed: %v", err)
  }

  h := newProxyHarnessWithOptions(t, nil, driver.ProxyOptions{SymbolProvider: provider})

  // Position on the greet declaration name (line 0, inside "greet").
  greetPos := map[string]any{"line": 0, "character": 17}

  // Without includeDeclaration: only the call site on line 6.
  h.sendEditor(symbolRequestBody(t, 1, "textDocument/references", map[string]any{
    "textDocument": map[string]any{"uri": mainURI},
    "position":     greetPos,
    "context":      map[string]any{"includeDeclaration": false},
  }))
  var usages []driver.LSPLocation
  decodeResult(t, h.recvEditor(), &usages)
  h.expectNoUpstreamFrame(150 * time.Millisecond)
  if len(usages) != 1 {
    t.Fatalf("references without declaration = %d, want 1: %+v", len(usages), usages)
  }
  if usages[0].Range.Start.Line != 6 {
    t.Fatalf("usage line = %d, want 6 (call site)", usages[0].Range.Start.Line)
  }

  // With includeDeclaration: the declaration on line 0 plus the call on line 6.
  h.sendEditor(symbolRequestBody(t, 2, "textDocument/references", map[string]any{
    "textDocument": map[string]any{"uri": mainURI},
    "position":     greetPos,
    "context":      map[string]any{"includeDeclaration": true},
  }))
  var withDecl []driver.LSPLocation
  decodeResult(t, h.recvEditor(), &withDecl)
  if len(withDecl) != 2 {
    t.Fatalf("references with declaration = %d, want 2: %+v", len(withDecl), withDecl)
  }
  lines := map[int]bool{}
  for _, loc := range withDecl {
    lines[loc.Range.Start.Line] = true
  }
  if !lines[0] || !lines[6] {
    t.Fatalf("references with declaration lines = %v, want {0,6}", lines)
  }
}
