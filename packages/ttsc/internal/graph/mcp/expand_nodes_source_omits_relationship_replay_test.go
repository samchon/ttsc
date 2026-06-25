package mcp_test

import (
  "fmt"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph/mcp"
)

// TestExpandNodesSourceOmitsRelationshipReplay verifies source expansion reopens
// a known declaration body without replaying graph relationships.
//
// `query_nodes` is the relationship index. Once an agent has a handle and asks
// for source, repeating outgoing/incoming edges turns every body lookup into a
// second graph dump and encourages more follow-up exploration.
//
//  1. Compile a caller that invokes a helper.
//  2. Expand the caller handle in source mode.
//  3. Assert the body is present but relationship arrows are not replayed.
func TestExpandNodesSourceOmitsRelationshipReplay(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true
  },
  "files": ["src/main.ts"]
}
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `
export function caller(): number {
  return helper()
}

export function helper(): number {
  return 1
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
  text := toolText(t, server, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"query_nodes","arguments":{"query":"caller helper","mode":"search"}}}`)
  handle := nodeHandleFromText(t, text, "function caller")
  expanded := toolText(t, server, fmt.Sprintf(`{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"expand_nodes","arguments":{"ids":[%q],"mode":"source"}}}`, handle))
  if !strings.Contains(expanded, "return helper()") {
    t.Fatalf("source expansion did not include caller body:\n%s", expanded)
  }
  if strings.Contains(expanded, "->") || strings.Contains(expanded, "<-") || strings.Contains(expanded, "~>") {
    t.Fatalf("source expansion replayed relationship edges:\n%s", expanded)
  }
}
