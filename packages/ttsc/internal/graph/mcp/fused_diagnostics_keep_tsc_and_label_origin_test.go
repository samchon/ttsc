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

// TestFusedDiagnosticsKeepTscAndLabelOrigin pins the two round-2 fixes:
//
//   - the compiler's type errors are never dropped when plugin findings are
//     injected. A plugin check can return its lint findings ALONE (@ttsc/lint
//     exits non-zero on an error, short-circuiting ttsc's check before the
//     semantic pass), so a replace would make real type errors vanish. The
//     fused set merges; both survive.
//   - origin is carried, not inferred from the code. The strict-null family
//     (TS18048) is >= 9000, the same band @ttsc/lint hashes into, so a numeric
//     split would strip the "TS" from a real compiler error. It must keep it.
func TestFusedDiagnosticsKeepTscAndLabelOrigin(t *testing.T) {
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
  // `x.toFixed()` on an optional parameter is TS18048 ("'x' is possibly
  // 'undefined'") — a real type error with a code >= 9000.
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export function risky(x?: number): string {
  return x.toFixed(0);
}
`)

  prog, _, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  defer func() { _ = prog.Close() }()

  var file string
  riskyLine := 0
  for _, f := range prog.SourceFiles() {
    if strings.HasSuffix(f.FileName(), "main.ts") {
      file = f.FileName()
      if idx := strings.Index(f.Text(), "function risky"); idx >= 0 {
        riskyLine = 1 + strings.Count(f.Text()[:idx], "\n")
      }
      break
    }
  }
  if file == "" || riskyLine == 0 {
    t.Fatal("could not locate risky in the fixture")
  }

  // Inject a lint finding on the same declaration — the case where ttsc's check
  // returns lint alone and a replace would have erased the TS18048 above.
  diagPath := filepath.Join(root, "diagnostics.json")
  diagJSON := fmt.Sprintf(
    `[{"file":%q,"start":null,"line":%d,"column":1,"code":9123,"message":"no-explicit-any: avoid any"}]`,
    file, riskyLine,
  )
  if err := os.WriteFile(diagPath, []byte(diagJSON), 0o644); err != nil {
    t.Fatal(err)
  }

  server := mcp.NewServer(prog, mcp.InjectedDiagnosticsProvider(diagPath))
  text := toolText(t, server, fmt.Sprintf(`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"query_diagnostics","arguments":{"files":[%q]}}}`, "main.ts"))

  // The type error survives the injected lint finding...
  if !strings.Contains(text, "TS18048") {
    t.Fatalf("the TS18048 type error was dropped when a lint finding was injected:\n%s", text)
  }
  // ...and keeps its TS prefix despite being >= 9000.
  if !strings.Contains(text, "no-explicit-any") {
    t.Fatalf("the injected lint finding was not surfaced:\n%s", text)
  }
}
