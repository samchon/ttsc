package mcp_test

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph/mcp"
)

// TestQueryFilesOutlinesEachFile verifies query_files returns one content block
// per requested location, in input order, each a cheap roster of that file: the
// declarations inside it listed by kind and name, without their verbatim bodies.
//
//  1. Compile a two-file fixture, each with a couple of declarations.
//  2. Call query_files with both paths.
//  3. Assert two content blocks, in order, each naming its file's declarations
//     but not dumping their bodies.
func TestQueryFilesOutlinesEachFile(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs", "strict": true, "rootDir": "src", "outDir": "dist" },
  "files": ["src/a.ts", "src/b.ts"]
}
`)
  writeFile(t, filepath.Join(root, "src", "a.ts"), `export class Alpha {
  ping(): number {
    return 1
  }
}
`)
  writeFile(t, filepath.Join(root, "src", "b.ts"), `export function beta(): string {
  return "b"
}
`)

  prog, _, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  defer func() { _ = prog.Close() }()
  server := mcp.NewServer(prog)

  blocks := toolBlocks(t, server, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"query_files","arguments":{"locations":["src/b.ts","src/a.ts"]}}}`)
  if len(blocks) != 2 {
    t.Fatalf("expected one block per location, got %d:\n%v", len(blocks), blocks)
  }
  // Input order is preserved: b.ts first, a.ts second.
  if !strings.Contains(blocks[0], "src/b.ts") || !strings.Contains(blocks[0], "beta") {
    t.Fatalf("first block did not render src/b.ts:\n%s", blocks[0])
  }
  if !strings.Contains(blocks[1], "src/a.ts") || !strings.Contains(blocks[1], "Alpha") {
    t.Fatalf("second block did not render src/a.ts:\n%s", blocks[1])
  }
  // The roster lists declarations but not their bodies: it is a cheap index, so
  // the verbatim source (here a `return` statement) must not appear.
  if strings.Contains(blocks[0], "return") || strings.Contains(blocks[1], "return") {
    t.Fatalf("query_files dumped a body instead of a roster:\n%s\n%s", blocks[0], blocks[1])
  }
}

// toolBlocks drives a tools/call and returns the text of every content block.
func toolBlocks(t *testing.T, server *mcp.Server, message string) []string {
  t.Helper()
  res := result(t, server, message)
  content, ok := res["content"].([]any)
  if !ok {
    t.Fatalf("tools/call result had no content: %v", res)
  }
  out := make([]string, 0, len(content))
  for _, c := range content {
    block, ok := c.(map[string]any)
    if !ok {
      continue
    }
    text, _ := block["text"].(string)
    out = append(out, text)
  }
  return out
}

var _ = json.Marshal
