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

// TestInjectedBackslashPathNormalizesAndFuses pins the Windows fix: the launcher
// resolves a finding's file with the OS separator, so on Windows it hands the
// server a backslash path, while the graph nodes and tsc diagnostics carry
// tsgo's forward-slash FileName(). Without normalization the injected path
// matches nothing and the whole plugin set silently fails to fuse. The provider
// normalizes, so a backslash-pathed finding still lands on its node.
func TestInjectedBackslashPathNormalizesAndFuses(t *testing.T) {
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
  line := 0
  for _, f := range prog.SourceFiles() {
    if strings.HasSuffix(f.FileName(), "main.ts") {
      file = f.FileName()
      if idx := strings.Index(f.Text(), "function widget"); idx >= 0 {
        line = 1 + strings.Count(f.Text()[:idx], "\n")
      }
      break
    }
  }
  if file == "" || line == 0 {
    t.Fatal("could not locate widget in the fixture")
  }

  // The launcher's OS-separator path, as Windows would write it.
  backslashFile := strings.ReplaceAll(file, "/", "\\")
  diagPath := filepath.Join(root, "diagnostics.json")
  diagJSON := fmt.Sprintf(
    `[{"file":%q,"start":null,"line":%d,"column":1,"code":9123,"message":"lint/no-foo: avoid foo"}]`,
    backslashFile, line,
  )
  if err := os.WriteFile(diagPath, []byte(diagJSON), 0o644); err != nil {
    t.Fatal(err)
  }

  server := mcp.NewServer(prog, mcp.InjectedDiagnosticsProvider(diagPath))
  text := toolText(t, server, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"graph_explore","arguments":{"query":"widget"}}}`)

  if !strings.Contains(text, "lint/no-foo") {
    t.Fatalf("a backslash-pathed injected finding did not fuse (path not normalized):\n%s", text)
  }
}
