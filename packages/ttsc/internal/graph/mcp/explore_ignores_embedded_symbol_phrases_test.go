package mcp_test

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph/mcp"
)

// TestExploreIgnoresEmbeddedSymbolPhrases verifies symbol matching does not
// treat substrings inside larger identifiers as standalone graph targets.
//
// A query for `SelectQueryBuilder.setFindOptions applyFindOptions` should return
// the named methods, not `FindOptions`, `QueryBuilder`, or unrelated sibling
// methods just because those names are embedded inside the larger symbols.
//
//  1. Compile a fixture with two named methods and nearby substring/sibling
//     declarations.
//  2. Explore the combined method query.
//  3. Assert only the named owner-member methods are returned.
func TestExploreIgnoresEmbeddedSymbolPhrases(t *testing.T) {
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
export interface FindOptions {
  enabled: boolean
}

export class QueryBuilder {
  run(): void {}
}

export class SelectQueryBuilder {
  setFindOptions(): void {
    this.applyFindOptions()
  }
  applyFindOptions(): void {}
  select(): void {}
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
  text := toolText(t, server, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"graph_explore","arguments":{"query":"SelectQueryBuilder.setFindOptions applyFindOptions"}}}`)
  for _, want := range []string{
    "method SelectQueryBuilder.setFindOptions",
    "method SelectQueryBuilder.applyFindOptions",
  } {
    if !strings.Contains(text, want) {
      t.Fatalf("graph_explore did not return %s:\n%s", want, text)
    }
  }
  for _, noise := range []string{
    "interface FindOptions",
    "class QueryBuilder",
    "method SelectQueryBuilder.select",
  } {
    if strings.Contains(text, noise) {
      t.Fatalf("graph_explore returned embedded/sibling noise %s:\n%s", noise, text)
    }
  }
}
