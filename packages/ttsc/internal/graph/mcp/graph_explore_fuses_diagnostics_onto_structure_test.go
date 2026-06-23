package mcp_test

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph/mcp"
)

// TestGraphExploreFusesDiagnosticsOntoStructure verifies the graph fuses the
// live "what is broken" view onto the static structure — the relationship that
// is unique to riding the real checker, and the fix-safety angle a separate
// structure graph plus a separate diagnostics tool cannot express:
//
//   - a declaration's own diagnostics show on its node (forward), and
//   - a symbol's blast radius reports how many dependents are already broken
//     (reverse), so before editing `leaf` an agent sees its change reaches a
//     dependent that is currently failing.
//
// Fixture: leaf() <- mid() <- top(), where mid also has a TS2322.
func TestGraphExploreFusesDiagnosticsOntoStructure(t *testing.T) {
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
  const broken: number = "not a number";
  return leaf() + broken;
}
`)
  writeFile(t, filepath.Join(root, "src", "top.ts"), `import { mid } from "./mid";
export function top(): number {
  return mid();
}
`)

  prog, _, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  defer func() { _ = prog.Close() }()

  server := mcp.NewServer(prog)

  // Forward: mid is broken, so its own diagnostic surfaces on its node.
  midText := toolText(t, server, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"graph_explore","arguments":{"query":"mid"}}}`)
  if !strings.Contains(midText, "diagnostics here") || !strings.Contains(midText, "TS2322") {
    t.Fatalf("graph_explore did not surface mid's own diagnostic:\n%s", midText)
  }

  // Reverse: leaf is fine, but its blast radius reaches the broken mid — the
  // fix-safety signal read before editing leaf.
  leafText := toolText(t, server, `{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"graph_explore","arguments":{"query":"leaf"}}}`)
  if !strings.Contains(leafText, "with current errors") {
    t.Fatalf("graph_explore did not report broken dependents in leaf's blast radius:\n%s", leafText)
  }
}
