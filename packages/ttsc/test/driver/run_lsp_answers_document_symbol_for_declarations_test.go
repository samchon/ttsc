package driver_test

import (
  "encoding/json"
  "net/url"
  "os"
  "path/filepath"
  "strconv"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graphsymbols"
)

// graphSymbolTSConfig is the minimal project the SymbolProvider probes compile
// their single-file fixture with. It mirrors the graph package's own fixture so
// lib resolution stays light and the program loads fast in-process.
const graphSymbolTSConfig = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/main.ts"]
}
`

// graphSymbolMainTS is a small TS file with a function, a class, and a method
// that calls the function — enough to exercise both documentSymbol (declarations
// become symbols, the method nesting under its class) and references (the call
// site becomes an edge/usage). Line numbers referenced by the tests:
//
//  0: export function greet(name: string): string {
//  1:   return "hi " + name;
//  2: }
//  3:
//  4: export class Service {
//  5:   run(): string {
//  6:     return greet("world");
//  7:   }
//  8: }
const graphSymbolMainTS = `export function greet(name: string): string {
  return "hi " + name;
}

export class Service {
  run(): string {
    return greet("world");
  }
}
`

// TestRunLSPAnswersDocumentSymbolForDeclarations proves ttscserver answers
// textDocument/documentSymbol locally (never forwarding to upstream tsgo) with
// the declarations of the requested file: a function and a class, the class's
// method nested under it.
func TestRunLSPAnswersDocumentSymbolForDeclarations(t *testing.T) {
  root, mainURI := writeGraphSymbolProject(t, graphSymbolMainTS)
  provider := graphsymbols.NewProvider(root, "tsconfig.json")
  // Warm the graph so the in-proxy handler resolves against a cached program
  // rather than paying the one-time compiler load inside the harness's frame
  // timeout; the proxy still computes the response from this graph.
  if _, err := provider.DocumentSymbols(mainURI); err != nil {
    t.Fatalf("provider load failed: %v", err)
  }

  h := newProxyHarnessWithOptions(t, nil, driver.ProxyOptions{SymbolProvider: provider})
  h.sendEditor(symbolRequestBody(t, 1, "textDocument/documentSymbol", map[string]any{
    "textDocument": map[string]any{"uri": mainURI},
  }))

  var symbols []driver.LSPDocumentSymbol
  decodeResult(t, h.recvEditor(), &symbols)
  // The request is answered locally, so nothing reaches upstream tsgo.
  h.expectNoUpstreamFrame(150 * time.Millisecond)

  byName := map[string]driver.LSPDocumentSymbol{}
  for _, s := range symbols {
    byName[s.Name] = s
  }
  greet, ok := byName["greet"]
  if !ok {
    t.Fatalf("missing function symbol greet; got %+v", symbols)
  }
  if greet.Kind != driver.LSPSymbolKind(12) { // Function
    t.Fatalf("greet kind = %d, want 12 (Function)", greet.Kind)
  }
  service, ok := byName["Service"]
  if !ok {
    t.Fatalf("missing class symbol Service; got %+v", symbols)
  }
  if service.Kind != driver.LSPSymbolKind(5) { // Class
    t.Fatalf("Service kind = %d, want 5 (Class)", service.Kind)
  }
  if len(service.Children) != 1 || service.Children[0].Name != "run" {
    t.Fatalf("Service children = %+v, want single method run", service.Children)
  }
  if service.Children[0].Kind != driver.LSPSymbolKind(6) { // Method
    t.Fatalf("run kind = %d, want 6 (Method)", service.Children[0].Kind)
  }
  // greet is declared on the first line; its range must point there, not at the
  // file start with leading trivia.
  if greet.SelectionRange.Start.Line != 0 {
    t.Fatalf("greet selection range line = %d, want 0", greet.SelectionRange.Start.Line)
  }
}

// writeGraphSymbolProject writes a temp project (tsconfig + src/main.ts) and
// returns its root plus the file:// uri of main.ts.
func writeGraphSymbolProject(t *testing.T, mainSrc string) (root, mainURI string) {
  t.Helper()
  root = t.TempDir()
  writeGraphSymbolFile(t, filepath.Join(root, "tsconfig.json"), graphSymbolTSConfig)
  mainPath := filepath.Join(root, "src", "main.ts")
  writeGraphSymbolFile(t, mainPath, mainSrc)
  return root, fileURIForPath(mainPath)
}

func writeGraphSymbolFile(t *testing.T, path, content string) {
  t.Helper()
  if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
    t.Fatal(err)
  }
}

// fileURIForPath encodes an OS path as a file:// uri the same way editors do,
// prefixing a leading slash for volume-qualified Windows paths.
func fileURIForPath(path string) string {
  uriPath := filepath.ToSlash(path)
  if filepath.VolumeName(path) != "" && uriPath[0] != '/' {
    uriPath = "/" + uriPath
  }
  return (&url.URL{Scheme: "file", Path: uriPath}).String()
}

// symbolRequestBody builds a JSON-RPC request frame body for the given method.
func symbolRequestBody(t *testing.T, id int, method string, params any) []byte {
  t.Helper()
  raw, err := json.Marshal(params)
  if err != nil {
    t.Fatal(err)
  }
  body, err := json.Marshal(driver.Envelope{
    JSONRPC: "2.0",
    ID:      json.RawMessage(strconv.Itoa(id)),
    Method:  method,
    Params:  raw,
  })
  if err != nil {
    t.Fatal(err)
  }
  return body
}

// decodeResult parses a response frame and unmarshals its result into out.
func decodeResult(t *testing.T, frame []byte, out any) {
  t.Helper()
  env, err := driver.ParseEnvelope(frame)
  if err != nil {
    t.Fatalf("parse response: %v", err)
  }
  if len(env.Error) > 0 {
    t.Fatalf("unexpected error response: %s", env.Error)
  }
  if err := json.Unmarshal(env.Result, out); err != nil {
    t.Fatalf("decode result %s: %v", env.Result, err)
  }
}
