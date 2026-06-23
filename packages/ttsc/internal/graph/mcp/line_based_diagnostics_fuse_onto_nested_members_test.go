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

// TestLineBasedDiagnosticsFuseOntoNestedMembers pins the two fixes the plugin
// path depends on:
//
//   - line-based attribution: a finding with NO byte offset (only a line — the
//     shape @ttsc/lint and transform plugins reach the graph through, since
//     ttsc's text banner carries no offset) is still placed on the declaration
//     whose line range contains it.
//   - member roll-up: exploring a CLASS surfaces a finding that lands on one of
//     its methods, so the fix-safety signal is not invisible at the symbol an
//     agent most naturally queries.
//
// It also confirms a plugin code (>= 9000) renders without the "TS" prefix.
func TestLineBasedDiagnosticsFuseOntoNestedMembers(t *testing.T) {
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
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export class Service {
  handle(): number {
    return 1;
  }
}

export function caller(): number {
  return new Service().handle();
}
`)

  prog, _, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  defer func() { _ = prog.Close() }()

  // The line of `return 1`, inside Service.handle — a lint finding's location.
  var file string
  line := 0
  for _, f := range prog.SourceFiles() {
    if strings.HasSuffix(f.FileName(), "main.ts") {
      file = f.FileName()
      text := f.Text()
      idx := strings.Index(text, "return 1")
      if idx >= 0 {
        line = 1 + strings.Count(text[:idx], "\n")
      }
      break
    }
  }
  if file == "" || line == 0 {
    t.Fatal("could not locate the method body line in the fixture")
  }

  // A line-only finding (start: null) with a plugin code (>= 9000), exactly the
  // shape the launcher writes for an @ttsc/lint violation.
  diagPath := filepath.Join(root, "diagnostics.json")
  diagJSON := fmt.Sprintf(
    `[{"file":%q,"start":null,"line":%d,"column":5,"code":9123,"message":"no-explicit-any: avoid any here"}]`,
    file, line,
  )
  if err := os.WriteFile(diagPath, []byte(diagJSON), 0o644); err != nil {
    t.Fatal(err)
  }

  server := mcp.NewServer(prog, mcp.InjectedDiagnosticsProvider(diagPath))

  // Exploring the CLASS surfaces the finding that lands on its method (roll-up),
  // even though the finding has no byte offset (line-based attribution).
  text := toolText(t, server, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"graph_explore","arguments":{"query":"Service"}}}`)
  if !strings.Contains(text, "no-explicit-any") {
    t.Fatalf("graph_explore on the class did not surface the line-attributed finding on its method:\n%s", text)
  }
  if strings.Contains(text, "TS9123") {
    t.Fatalf("plugin-coded finding rendered with a TS prefix:\n%s", text)
  }
}
