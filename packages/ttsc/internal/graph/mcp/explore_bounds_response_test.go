package mcp_test

import (
  "fmt"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph/mcp"
)

// TestExploreBoundsResponse verifies that query_nodes enforces its three render
// budgets so one query cannot flood an agent's context: a long body is truncated
// to maxSourceLines (32) with a "more lines" tail, a node with more than
// maxEdgesPerDirection (12) incoming edges gets a "more" tail, and once the
// verbatim source crosses the query's budget cap — exploreBudgetMax (16000) — the remaining matched nodes collapse to
// signatures.
//
//  1. Compile a fixture with a 40-statement function, a Hub type referenced by 17
//     functions, and six large process* functions.
//  2. Build the server from the resident Program.
//  3. Assert each budget marker appears in the matching explore response.
func TestExploreBoundsResponse(t *testing.T) {
  root := t.TempDir()

  var src strings.Builder

  // (a) bigBody: a function whose body is 40 trivial statements, past the
  // maxSourceLines (32) cap, so its render carries a "more lines" tail.
  src.WriteString("export function bigBody(): void {\n")
  for i := 0; i < 40; i++ {
    fmt.Fprintf(&src, "  const a%d = 0;\n", i)
  }
  src.WriteString("}\n")

  // (b) Hub: an interface referenced as a parameter type by 17 functions, five
  // past the maxEdgesPerDirection (12) cap, so its incoming edges carry a "more"
  // tail.
  src.WriteString("export interface Hub {}\n")
  for i := 0; i < 17; i++ {
    fmt.Fprintf(&src, "export function u%d(h: Hub): void {}\n", i)
  }

  // (c) Six process* functions each with a large body, so the verbatim source
  // crosses the broad-query budget cap (exploreBudgetMax, 16000) and the later matches
  // collapse to signatures. The statement lines are deliberately long so the
  // rendered bodies exceed the byte budget.
  for _, name := range []string{"processAlpha", "processBeta", "processGamma", "processDelta", "processEpsilon", "processZeta"} {
    fmt.Fprintf(&src, "export function %s(): number {\n", name)
    fmt.Fprintf(&src, "  let total%s: number = 0;\n", name)
    for i := 0; i < 40; i++ {
      fmt.Fprintf(&src, "  total%s = total%s + %d + 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12 + 13 + 14 + 15 + 16 + 17 + 18 + 19 + 20;\n", name, name, i)
    }
    fmt.Fprintf(&src, "  return total%s;\n", name)
    src.WriteString("}\n")
  }

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

  // (a) A 40-line body is truncated with a "more lines" tail.
  big := toolText(t, server, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"query_nodes","arguments":{"query":"bigBody"}}}`)
  if !strings.Contains(big, "more lines)") {
    t.Fatalf("query_nodes did not truncate the long body:\n%s", big)
  }

  // (b) A node with 17 incoming edges carries a "<- (5 more)" tail: 17 minus the
  // 12-edge cap, and the direction (incoming) is pinned, not just any "more".
  hub := toolText(t, server, `{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"query_nodes","arguments":{"query":"Hub"}}}`)
  if !strings.Contains(hub, "<- (5 more)") {
    t.Fatalf("query_nodes did not cap the incoming edges at 12 with a '<- (5 more)' tail:\n%s", hub)
  }

  // (c) Three large bodies cross the char budget, collapsing later matches.
  process := toolText(t, server, `{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"query_nodes","arguments":{"query":"alpha beta gamma delta epsilon zeta"}}}`)
  if !strings.Contains(process, "shown as signatures to fit the response budget") {
    t.Fatalf("query_nodes did not collapse later matches to signatures:\n%s", process)
  }
}
