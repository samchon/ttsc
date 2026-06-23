package mcp_test

import (
  "fmt"
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph/mcp"
)

// TestInjectedDiagnosticsProviderFusesFileFindings verifies the consumption end
// of plugin-aware diagnostics: a JSON file of host-supplied findings (the
// @ttsc/lint and transform-plugin diagnostics the launcher computes) is read,
// parsed, and fused onto the graph exactly like a tsc error — so once the
// launcher writes the file, graph_explore surfaces lint and plugin violations
// with no further change to the binary.
func TestInjectedDiagnosticsProviderFusesFileFindings(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/main.ts"]
}
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export function widget(): number {
  return 1;
}
`)

  prog, _, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  defer func() { _ = prog.Close() }()

  // Locate widget's file and the byte offset of its declaration, the position a
  // lint finding on it would carry.
  var file string
  off := -1
  for _, f := range prog.SourceFiles() {
    if strings.HasSuffix(f.FileName(), "main.ts") {
      file = f.FileName()
      off = strings.Index(f.Text(), "function widget")
      break
    }
  }
  if file == "" || off < 0 {
    t.Fatal("could not locate widget in the fixture")
  }

  // A lint finding uses code 0 (its rule is in the message), the convention the
  // launcher serializes plugin/lint diagnostics with so they never collide with
  // tsc's numeric codes.
  diagPath := filepath.Join(root, "lint-diagnostics.json")
  diagJSON := fmt.Sprintf(
    `[{"file":%q,"start":%d,"line":1,"column":1,"code":0,"message":"lint/no-foo: avoid foo"}]`,
    file, off,
  )
  if err := os.WriteFile(diagPath, []byte(diagJSON), 0o644); err != nil {
    t.Fatal(err)
  }

  server := mcp.NewServer(prog, mcp.InjectedDiagnosticsProvider(diagPath))
  text := toolText(t, server, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"graph_explore","arguments":{"query":"widget"}}}`)

  if !strings.Contains(text, "lint/no-foo") {
    t.Fatalf("graph_explore did not surface the injected lint finding on widget:\n%s", text)
  }
  // A code-0 finding renders without a "TS" prefix.
  if strings.Contains(text, "TS0") {
    t.Fatalf("code-0 lint finding rendered with a TS prefix:\n%s", text)
  }
}
