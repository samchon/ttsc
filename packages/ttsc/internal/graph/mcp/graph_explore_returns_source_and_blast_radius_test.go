package mcp_test

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph/mcp"
)

// TestGraphExploreReturnsSourceAndBlastRadius verifies the fat query_nodes tool
// answers a structural question in one round-trip: it returns the matched node's
// verbatim line-numbered source, its checker-resolved incoming call edge, and a
// blast-radius count of transitive dependents, so an agent can stop instead of
// fanning out to read files.
//
//  1. Compile a call chain top() -> mid() -> leaf(), each in its own file.
//  2. Explore "leaf".
//  3. Assert the response carries leaf's source, the incoming value-call edge
//     from mid, and a blast radius of 2 (mid and top transitively depend on leaf).
func TestGraphExploreReturnsSourceAndBlastRadius(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/top.ts"]
}
`)
  writeFile(t, filepath.Join(root, "src", "leaf.ts"), `export function leaf(): number {
  return 1;
}
`)
  writeFile(t, filepath.Join(root, "src", "mid.ts"), `import { leaf } from "./leaf";
export function mid(): number {
  return leaf();
}
`)
  writeFile(t, filepath.Join(root, "src", "top.ts"), `import { mid } from "./mid";
export function top(): number {
  return mid();
}
`)

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %v", diags)
  }
  defer func() { _ = prog.Close() }()

  server := mcp.NewServer(prog)
  text := toolText(t, server, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"query_nodes","arguments":{"query":"leaf"}}}`)

  if !strings.Contains(text, "function leaf") {
    t.Fatalf("query_nodes did not return verbatim source for leaf:\n%s", text)
  }
  if !strings.Contains(text, "value-call") {
    t.Fatalf("query_nodes did not show the incoming call edge from mid:\n%s", text)
  }
  if !strings.Contains(text, "blast radius: 2") {
    t.Fatalf("query_nodes did not report 2 transitive dependents for leaf:\n%s", text)
  }
}
