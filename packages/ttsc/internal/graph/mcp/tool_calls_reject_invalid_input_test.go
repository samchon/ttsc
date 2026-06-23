package mcp_test

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph/mcp"
)

// TestToolCallsRejectInvalidInput verifies that each tools/call guard returns the
// invalid-params code -32602 with a message naming the fault, so an agent gets an
// actionable error instead of an empty or arbitrary result. It pins three guards:
// an unknown tool name, a blank graph_explore query, and a blank graph_diagnostics
// file argument.
//
//  1. Build the server from a minimal one-file fixture.
//  2. Drive a tools/call for each invalid input.
//  3. Assert each returns code -32602 with the expected message fragment.
func TestToolCallsRejectInvalidInput(t *testing.T) {
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
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export const value: number = 1;
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

  // An unknown tool name is rejected, not silently ignored.
  unknown := errorOf(t, server, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"bogus","arguments":{}}}`)
  if unknown["code"] != float64(-32602) {
    t.Fatalf("unknown tool code was not -32602: %v", unknown["code"])
  }
  if msg, _ := unknown["message"].(string); !strings.Contains(msg, "unknown tool") {
    t.Fatalf("unknown tool message did not name the fault: %v", unknown["message"])
  }

  // A blank graph_explore query is rejected.
  blankQuery := errorOf(t, server, `{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"graph_explore","arguments":{"query":"  "}}}`)
  if blankQuery["code"] != float64(-32602) {
    t.Fatalf("blank query code was not -32602: %v", blankQuery["code"])
  }
  if msg, _ := blankQuery["message"].(string); !strings.Contains(msg, "non-empty") {
    t.Fatalf("blank query message did not mention non-empty: %v", blankQuery["message"])
  }

  // A blank graph_diagnostics file argument is rejected.
  blankFile := errorOf(t, server, `{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"graph_diagnostics","arguments":{"file":""}}}`)
  if blankFile["code"] != float64(-32602) {
    t.Fatalf("blank file code was not -32602: %v", blankFile["code"])
  }
  if msg, _ := blankFile["message"].(string); !strings.Contains(msg, "non-empty") {
    t.Fatalf("blank file message did not mention non-empty: %v", blankFile["message"])
  }
}
