package mcp_test

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph/mcp"
)

// TestToolCallsRejectInvalidInput verifies that each tools/call guard returns the
// invalid-params code -32602 with a message naming the fault, so an agent gets
// an actionable error instead of an empty or arbitrary result. It pins rejection
// guards (an unknown tool name, bad query_exports pagination, a blank
// query_nodes query, and invalid expand_nodes arguments) and confirms inputs
// that are deliberately not faults: query_exports limit 0 means "summary only",
// and a blank query_diagnostics file means "the whole project".
//
//  1. Build the server from a minimal one-file fixture.
//  2. Drive a tools/call for each input.
//  3. Assert the two faults return code -32602, and the blank file returns a result.
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

  summaryOnly := toolText(t, server, `{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"query_exports","arguments":{"limit":0}}}`)
  if !strings.Contains(summaryOnly, "Exports: showing 0 of") || strings.Contains(summaryOnly, "Exported symbols:") {
    t.Fatalf("query_exports limit 0 did not return summary-only output:\n%s", summaryOnly)
  }

  badLimit := errorOf(t, server, `{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"query_exports","arguments":{"limit":10001}}}`)
  if badLimit["code"] != float64(-32602) {
    t.Fatalf("bad query_exports limit code was not -32602: %v", badLimit["code"])
  }
  if msg, _ := badLimit["message"].(string); !strings.Contains(msg, "limit") {
    t.Fatalf("bad query_exports limit message did not name the fault: %v", badLimit["message"])
  }

  badOffset := errorOf(t, server, `{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"query_exports","arguments":{"offset":-1}}}`)
  if badOffset["code"] != float64(-32602) {
    t.Fatalf("bad query_exports offset code was not -32602: %v", badOffset["code"])
  }
  if msg, _ := badOffset["message"].(string); !strings.Contains(msg, "offset") {
    t.Fatalf("bad query_exports offset message did not name the fault: %v", badOffset["message"])
  }

  // A blank query_nodes query is rejected.
  blankQuery := errorOf(t, server, `{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"query_nodes","arguments":{"query":"  "}}}`)
  if blankQuery["code"] != float64(-32602) {
    t.Fatalf("blank query code was not -32602: %v", blankQuery["code"])
  }
  if msg, _ := blankQuery["message"].(string); !strings.Contains(msg, "non-empty") {
    t.Fatalf("blank query message did not mention non-empty: %v", blankQuery["message"])
  }

  blankExpand := errorOf(t, server, `{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"expand_nodes","arguments":{"ids":[]}}}`)
  if blankExpand["code"] != float64(-32602) {
    t.Fatalf("blank expand code was not -32602: %v", blankExpand["code"])
  }
  if msg, _ := blankExpand["message"].(string); !strings.Contains(msg, "non-empty") {
    t.Fatalf("blank expand message did not mention non-empty: %v", blankExpand["message"])
  }

  badMode := errorOf(t, server, `{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"expand_nodes","arguments":{"ids":["n:deadbeef"],"mode":"impact"}}}`)
  if badMode["code"] != float64(-32602) {
    t.Fatalf("bad expand mode code was not -32602: %v", badMode["code"])
  }
  if msg, _ := badMode["message"].(string); !strings.Contains(msg, "source or flow") {
    t.Fatalf("bad expand mode message did not name valid modes: %v", badMode["message"])
  }

  // A blank query_diagnostics file is not an error: it asks for the whole
  // project's diagnostics. The one-file fixture is clean, so the project-wide
  // listing reports none rather than rejecting the call.
  projectDiag := toolText(t, server, `{"jsonrpc":"2.0","id":8,"method":"tools/call","params":{"name":"query_diagnostics","arguments":{"files":[""]}}}`)
  if !strings.Contains(projectDiag, "No error diagnostics") {
    t.Fatalf("blank file did not return whole-project diagnostics: %v", projectDiag)
  }
}
