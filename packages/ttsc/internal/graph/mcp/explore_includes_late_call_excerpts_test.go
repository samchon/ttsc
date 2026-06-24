package mcp_test

import (
  "fmt"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph/mcp"
)

// TestExploreIncludesLateCallExcerpts verifies graph_explore keeps checker-known
// call-flow context visible even when a long declaration body is truncated.
//
// Long methods are intentionally capped, but code-flow questions often need the
// late call sites that explain why the returned edges matter. Printing concise
// excerpts for checker-resolved value calls avoids a follow-up file read for the
// same source range.
//
//  1. Compile a function whose call to helper appears after the source-line cap.
//  2. Explore the caller.
//  3. Assert the body is still truncated and the late helper call is included.
func TestExploreIncludesLateCallExcerpts(t *testing.T) {
  root := t.TempDir()
  var src strings.Builder
  src.WriteString("export function lateFlow(): number {\n")
  for i := 0; i < 28; i++ {
    fmt.Fprintf(&src, "  const value%d = %d;\n", i, i)
  }
  src.WriteString("  return helper()\n")
  src.WriteString("}\n")
  src.WriteString("export function helper(): number {\n")
  src.WriteString("  return 1\n")
  src.WriteString("}\n")

  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true
  },
  "files": ["src/main.ts"]
}
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"), src.String())

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected parse diagnostics: %v", diags)
  }
  defer func() { _ = prog.Close() }()

  server := mcp.NewServer(prog)
  text := toolText(t, server, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"graph_explore","arguments":{"query":"lateFlow"}}}`)
  if !strings.Contains(text, "more lines)") {
    t.Fatalf("graph_explore did not truncate the long body:\n%s", text)
  }
  if !strings.Contains(text, "call excerpts after truncated body:") ||
    !strings.Contains(text, "return helper()") {
    t.Fatalf("graph_explore did not include the late value-call excerpt:\n%s", text)
  }
}
