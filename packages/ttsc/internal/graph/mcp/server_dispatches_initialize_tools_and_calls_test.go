package mcp_test

import (
  "encoding/json"
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph/mcp"
)

// TestServerDispatchesInitializeToolsAndCalls verifies the MCP server answers the
// three request shapes an agent drives it with, over the resident graph: the
// initialize handshake (echoing the protocol version and shipping guidance), the
// tools/list advertisement, and tools/call for both graph_explore (relationship
// map) and graph_diagnostics (tsc errors). It also confirms a notification (no
// id) draws no reply.
//
//  1. Compile a fixture with a heritage edge (Sub extends Base) and a type error.
//  2. Build the server from the resident Program.
//  3. Drive initialize, notifications/initialized, tools/list, and both tools,
//     asserting the responses.
func TestServerDispatchesInitializeToolsAndCalls(t *testing.T) {
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
  writeFile(t, filepath.Join(root, "src", "base.ts"), `export class Base {}
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `import { Base } from "./base";
export class Sub extends Base {}
export const bad: number = "not a number";
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

  // initialize echoes the client protocol version and ships guidance.
  init := result(t, server, `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}`)
  if init["protocolVersion"] != "2025-06-18" {
    t.Fatalf("initialize did not echo the protocol version: %v", init["protocolVersion"])
  }
  if info, _ := init["serverInfo"].(map[string]any); info == nil || info["name"] != "ttsc-graph" {
    t.Fatalf("initialize serverInfo missing or wrong: %v", init["serverInfo"])
  }
  if text, _ := init["instructions"].(string); !strings.Contains(text, "graph_explore") {
    t.Fatalf("initialize did not ship server instructions: %v", init["instructions"])
  }

  // A notification (no id) draws no reply.
  if out, ok := server.Handle([]byte(`{"jsonrpc":"2.0","method":"notifications/initialized"}`)); ok {
    t.Fatalf("a notification drew a reply: %s", out)
  }

  // tools/list advertises both tools.
  list := result(t, server, `{"jsonrpc":"2.0","id":2,"method":"tools/list"}`)
  names := toolNames(t, list)
  if !names["graph_explore"] || !names["graph_diagnostics"] {
    t.Fatalf("tools/list missing expected tools: %v", names)
  }

  // graph_explore renders the heritage relationship for Sub.
  explore := toolText(t, server, `{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"graph_explore","arguments":{"query":"Sub"}}}`)
  if !strings.Contains(explore, "Sub") || !strings.Contains(explore, "Base") || !strings.Contains(explore, "heritage") {
    t.Fatalf("graph_explore did not render the Sub -> Base heritage edge:\n%s", explore)
  }

  // graph_diagnostics surfaces the type error with its tsc code.
  diag := toolText(t, server, `{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"graph_diagnostics","arguments":{"file":"src/main.ts"}}}`)
  if !strings.Contains(diag, "TS2322") {
    t.Fatalf("graph_diagnostics did not surface the TS2322 error:\n%s", diag)
  }

  // An unknown method is a JSON-RPC error, not a crash.
  if errObj := errorOf(t, server, `{"jsonrpc":"2.0","id":5,"method":"no/such"}`); errObj["code"] == nil {
    t.Fatalf("unknown method did not return an error object")
  }
}

// result drives one request and returns its `result` object, failing on an error
// response or a missing result.
func result(t *testing.T, server *mcp.Server, message string) map[string]any {
  t.Helper()
  out, ok := server.Handle([]byte(message))
  if !ok {
    t.Fatalf("no reply for %s", message)
  }
  var envelope map[string]any
  if err := json.Unmarshal(out, &envelope); err != nil {
    t.Fatal(err)
  }
  if envelope["error"] != nil {
    t.Fatalf("unexpected error response: %v", envelope["error"])
  }
  res, ok := envelope["result"].(map[string]any)
  if !ok {
    t.Fatalf("response had no result object: %s", out)
  }
  return res
}

// errorOf drives one request and returns its `error` object, failing when the
// response carries a result instead.
func errorOf(t *testing.T, server *mcp.Server, message string) map[string]any {
  t.Helper()
  out, ok := server.Handle([]byte(message))
  if !ok {
    t.Fatalf("no reply for %s", message)
  }
  var envelope map[string]any
  if err := json.Unmarshal(out, &envelope); err != nil {
    t.Fatal(err)
  }
  res, ok := envelope["error"].(map[string]any)
  if !ok {
    t.Fatalf("response had no error object: %s", out)
  }
  return res
}

// toolNames returns the set of tool names from a tools/list result.
func toolNames(t *testing.T, list map[string]any) map[string]bool {
  t.Helper()
  tools, ok := list["tools"].([]any)
  if !ok {
    t.Fatalf("tools/list has no tools array: %v", list)
  }
  names := map[string]bool{}
  for _, entry := range tools {
    if tool, ok := entry.(map[string]any); ok {
      if name, ok := tool["name"].(string); ok {
        names[name] = true
      }
    }
  }
  return names
}

// toolText drives a tools/call request and returns the text of its first content
// block.
func toolText(t *testing.T, server *mcp.Server, message string) string {
  t.Helper()
  res := result(t, server, message)
  content, ok := res["content"].([]any)
  if !ok || len(content) == 0 {
    t.Fatalf("tools/call result had no content: %v", res)
  }
  first, ok := content[0].(map[string]any)
  if !ok {
    t.Fatalf("content block was not an object: %v", content[0])
  }
  text, ok := first["text"].(string)
  if !ok {
    t.Fatalf("content block had no text: %v", first)
  }
  return text
}

// writeFile writes content to path, creating parent directories.
func writeFile(t *testing.T, path, content string) {
  t.Helper()
  if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
    t.Fatal(err)
  }
}
