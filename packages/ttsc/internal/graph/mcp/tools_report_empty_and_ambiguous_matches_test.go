package mcp_test

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph/mcp"
)

// TestToolsReportEmptyAndAmbiguousMatches verifies the tools narrate the cases
// where there is nothing to show or too much: a query that matches no node, a file
// fragment that matches no source file, a real file with no type errors, and a
// fragment that matches more than one file. The last pins the ambiguity fix:
// rather than silently picking the first file, graph_diagnostics lists the matches
// and asks for a longer fragment.
//
//  1. Build a server over two files both named util.ts under distinct directories.
//  2. Drive graph_explore and graph_diagnostics with no-match and bare-file args.
//  3. Assert the empty-result narrations and the "matches 2 files" disambiguation.
func TestToolsReportEmptyAndAmbiguousMatches(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/a/util.ts", "src/b/util.ts"]
}
`)
  writeFile(t, filepath.Join(root, "src", "a", "util.ts"), `export function alpha(): number {
  return 1;
}
`)
  writeFile(t, filepath.Join(root, "src", "b", "util.ts"), `export function beta(): number {
  return 2;
}
`)

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected parse diagnostics: %v", diags)
  }
  defer func() { _ = prog.Close() }()
  server := mcp.NewServer(prog)

  // A query that matches no node narrates the miss.
  noNode := toolText(t, server, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"graph_explore","arguments":{"query":"zzzznotathing"}}}`)
  if !strings.Contains(noNode, "No graph nodes match") {
    t.Fatalf("graph_explore did not narrate a no-node miss:\n%s", noNode)
  }

  // A file fragment that matches no source file narrates the miss.
  noFile := toolText(t, server, `{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"graph_diagnostics","arguments":{"file":"zzzznotafile.ts"}}}`)
  if !strings.Contains(noFile, "No project source file matches") {
    t.Fatalf("graph_diagnostics did not narrate a no-file miss:\n%s", noFile)
  }

  // A real file with no type errors narrates the clean bill of health.
  clean := toolText(t, server, `{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"graph_diagnostics","arguments":{"file":"src/a/util.ts"}}}`)
  if !strings.Contains(clean, "No diagnostics for") {
    t.Fatalf("graph_diagnostics did not narrate a clean file:\n%s", clean)
  }

  // An ambiguous fragment lists the matches instead of picking one.
  ambiguous := toolText(t, server, `{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"graph_diagnostics","arguments":{"file":"util.ts"}}}`)
  if !strings.Contains(ambiguous, "matches 2 files") {
    t.Fatalf("graph_diagnostics did not flag the ambiguous fragment:\n%s", ambiguous)
  }
}
