package mcp_test

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph/mcp"
)

// TestExploreRanksDottedSymbolMatch verifies query_nodes prefers a full dotted
// symbol mentioned in a natural-language query over same-owner siblings.
//
// Benchmark prompts often name methods as `Owner.method()`. Splitting only into
// natural-language tokens makes generic method names such as "create" either too
// noisy when kept or invisible when dropped as stopwords. A full dotted-symbol
// phrase should therefore anchor the exact node before sibling methods. Agents
// also ask for methods as "Owner create method"; that should resolve to
// Owner.create instead of dumping the large owner class.
//
//  1. Build a tiny project with three same-owner methods.
//  2. Query for `ShoppingOrderProvider.create` and `ShoppingOrderProvider create method`.
//  3. Assert the create method appears before the owner class and sibling `at` method.
func TestExploreRanksDottedSymbolMatch(t *testing.T) {
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
export class ShoppingOrderProvider {
  at(): number {
    return 1;
  }
  create(): number {
    return 2;
  }
  erase(): number {
    return 3;
  }
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
  text := toolText(t, server, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"query_nodes","arguments":{"query":"ShoppingOrderProvider.create order path"}}}`)

  createAt := strings.Index(text, "method ShoppingOrderProvider.create")
  atAt := strings.Index(text, "method ShoppingOrderProvider.at")
  if createAt < 0 {
    t.Fatalf("query_nodes did not return ShoppingOrderProvider.create:\n%s", text)
  }
  classAt := strings.Index(text, "class ShoppingOrderProvider")
  if classAt >= 0 && classAt < createAt {
    t.Fatalf("query_nodes ranked owner class before dotted method match:\n%s", text)
  }
  if atAt >= 0 && atAt < createAt {
    t.Fatalf("query_nodes ranked sibling method before dotted symbol match:\n%s", text)
  }

  text = toolText(t, server, `{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"query_nodes","arguments":{"query":"ShoppingOrderProvider create method"}}}`)
  createAt = strings.Index(text, "method ShoppingOrderProvider.create")
  atAt = strings.Index(text, "method ShoppingOrderProvider.at")
  if createAt < 0 {
    t.Fatalf("query_nodes did not return ShoppingOrderProvider.create for natural method query:\n%s", text)
  }
  classAt = strings.Index(text, "class ShoppingOrderProvider")
  if classAt >= 0 && classAt < createAt {
    t.Fatalf("query_nodes ranked owner class before natural method match:\n%s", text)
  }
  if atAt >= 0 && atAt < createAt {
    t.Fatalf("query_nodes ranked sibling method before natural method match:\n%s", text)
  }
}
