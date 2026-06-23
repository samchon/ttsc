package mcp_test

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph/mcp"
)

// TestDiagnosticProvidersFeedTheFusedGraph verifies the seam a plugin-aware host
// uses: a diagnostic provider (standing in for the @ttsc/lint engine or a
// transform plugin) contributes findings over the same Program, and they fuse
// onto graph nodes exactly like the tsc diagnostics — so once a host links the
// project's plugins, graph_explore surfaces lint and plugin violations through
// the path already exercised here, with no further change to the graph.
func TestDiagnosticProvidersFeedTheFusedGraph(t *testing.T) {
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
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export function target(): number {
  return 1;
}
export function caller(): number {
  return target();
}
`)

  prog, _, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  defer func() { _ = prog.Close() }()

  // A stand-in lint provider: report a finding on `target`, positioned inside
  // its declaration so it attributes to the target node.
  provider := func(p *driver.Program) []driver.Diagnostic {
    for _, file := range p.SourceFiles() {
      if !strings.HasSuffix(file.FileName(), "/target-marker") && !strings.HasSuffix(file.FileName(), "main.ts") {
        continue
      }
      text := file.Text()
      off := strings.Index(text, "function target")
      if off < 0 {
        continue
      }
      pos := off
      return []driver.Diagnostic{{
        File:    file.FileName(),
        Start:   &pos,
        Line:    1,
        Code:    9999,
        Message: "synthetic lint finding",
      }}
    }
    return nil
  }

  server := mcp.NewServer(prog, provider)
  text := toolText(t, server, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"graph_explore","arguments":{"query":"target"}}}`)

  if !strings.Contains(text, "synthetic lint finding") {
    t.Fatalf("graph_explore did not surface the injected provider diagnostic on target:\n%s", text)
  }
  // A plugin/lint code (>= 9000) renders without the "TS" prefix reserved for
  // TypeScript compiler diagnostics.
  if strings.Contains(text, "TS9999") {
    t.Fatalf("plugin-coded finding rendered with a TS prefix:\n%s", text)
  }
}
