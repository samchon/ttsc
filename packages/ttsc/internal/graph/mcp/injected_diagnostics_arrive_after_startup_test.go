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

// TestInjectedDiagnosticsArriveAfterStartup verifies the timing the launcher
// relies on: the server starts and answers immediately while the plugin-aware
// check runs in the background, and once that check writes its diagnostics file
// the next query picks it up — no restart, no blocking the MCP handshake on a
// full compile. The fused diagnostic set is recomputed per query, so a file
// that lands after startup is read on the following call.
func TestInjectedDiagnosticsArriveAfterStartup(t *testing.T) {
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

  // The launcher names the diagnostics file up front and points the server at
  // it; the file does not exist yet because the background check has not
  // finished.
  diagPath := filepath.Join(root, "lint-diagnostics.json")
  server := mcp.NewServer(prog, mcp.InjectedDiagnosticsProvider(diagPath))

  before := toolText(t, server, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"graph_explore","arguments":{"query":"widget"}}}`)
  if strings.Contains(before, "lint/late-rule") {
    t.Fatalf("injected diagnostic surfaced before its file was written:\n%s", before)
  }

  // The background check finishes and writes the file.
  diagJSON := fmt.Sprintf(
    `[{"file":%q,"start":%d,"line":1,"column":1,"code":0,"message":"lint/late-rule: arrived after startup"}]`,
    file, off,
  )
  if err := os.WriteFile(diagPath, []byte(diagJSON), 0o644); err != nil {
    t.Fatal(err)
  }

  after := toolText(t, server, `{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"graph_explore","arguments":{"query":"widget"}}}`)
  if !strings.Contains(after, "lint/late-rule") {
    t.Fatalf("late-arriving injected diagnostic was not picked up on the next query:\n%s", after)
  }
}
