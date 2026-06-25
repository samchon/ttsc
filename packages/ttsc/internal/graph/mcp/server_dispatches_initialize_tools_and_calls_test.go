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
// tools/list advertisement, and tools/call for query_exports, query_nodes (relationship
// map) and query_diagnostics (tsc errors). It also confirms a notification (no
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
  if text, _ := init["instructions"].(string); !strings.Contains(text, "query_exports") || !strings.Contains(text, "query_nodes") {
    t.Fatalf("initialize did not ship server instructions: %v", init["instructions"])
  }

  // A notification (no id) draws no reply.
  if out, ok := server.Handle([]byte(`{"jsonrpc":"2.0","method":"notifications/initialized"}`)); ok {
    t.Fatalf("a notification drew a reply: %s", out)
  }

  // tools/list advertises the graph tools.
  list := result(t, server, `{"jsonrpc":"2.0","id":2,"method":"tools/list"}`)
  names := toolNames(t, list)
  if !names["query_exports"] || !names["query_nodes"] || !names["expand_nodes"] || !names["query_files"] || !names["query_diagnostics"] {
    t.Fatalf("tools/list missing expected tools: %v", names)
  }
  tools := toolsByName(t, list)
  exports := tools["query_exports"]
  if desc, _ := exports["description"].(string); !strings.Contains(desc, "Use this first") {
    t.Fatalf("query_exports did not use the embedded description: %v", desc)
  }
  exportsSchema := exports["inputSchema"].(map[string]any)
  exportsProperties := exportsSchema["properties"].(map[string]any)
  exportsQuery := exportsProperties["query"].(map[string]any)
  if desc, _ := exportsQuery["description"].(string); !strings.Contains(desc, "Optional filter") {
    t.Fatalf("query_exports query did not use the embedded description: %v", desc)
  }
  exportsLimit := exportsProperties["limit"].(map[string]any)
  if exportsLimit["type"] != "integer" || exportsLimit["minimum"] != float64(0) || exportsLimit["default"] != float64(1000) || exportsLimit["maximum"] != float64(10000) {
    t.Fatalf("query_exports limit schema was not bounded with defaults: %v", exportsLimit)
  }
  exportsOffset := exportsProperties["offset"].(map[string]any)
  if exportsOffset["type"] != "integer" || exportsOffset["minimum"] != float64(0) || exportsOffset["default"] != float64(0) {
    t.Fatalf("query_exports offset schema was not bounded with defaults: %v", exportsOffset)
  }
  nodes := tools["query_nodes"]
  if desc, _ := nodes["description"].(string); !strings.Contains(desc, "One broad fuzzy query") {
    t.Fatalf("query_nodes did not use the embedded description: %v", desc)
  }
  nodesSchema := nodes["inputSchema"].(map[string]any)
  nodesProperties := nodesSchema["properties"].(map[string]any)
  queryProperty := nodesProperties["query"].(map[string]any)
  if desc, _ := queryProperty["description"].(string); !strings.Contains(desc, "broad search, not one symbol") {
    t.Fatalf("query_nodes query did not use the embedded description: %v", desc)
  }
  modeProperty := nodesProperties["mode"].(map[string]any)
  if desc, _ := modeProperty["description"].(string); !strings.Contains(desc, "flow") {
    t.Fatalf("query_nodes mode did not use the embedded description: %v", desc)
  }
  expand := tools["expand_nodes"]
  if desc, _ := expand["description"].(string); !strings.Contains(desc, "Exact source expansion") {
    t.Fatalf("expand_nodes did not use the embedded description: %v", desc)
  }
  diagnostics := tools["query_diagnostics"]
  if desc, _ := diagnostics["description"].(string); !strings.Contains(desc, "exactly as ttsc reports them") {
    t.Fatalf("query_diagnostics did not use the embedded description: %v", desc)
  }
  diagnosticsSchema := diagnostics["inputSchema"].(map[string]any)
  diagnosticsProperties := diagnosticsSchema["properties"].(map[string]any)
  filesProperty := diagnosticsProperties["files"].(map[string]any)
  if desc, _ := filesProperty["description"].(string); !strings.Contains(desc, "src/main.ts") {
    t.Fatalf("query_diagnostics files did not use the embedded description: %v", desc)
  }

  // query_nodes renders the heritage relationship for Sub.
  exploreText := toolText(t, server, `{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"query_nodes","arguments":{"query":"Sub"}}}`)
  if !strings.Contains(exploreText, "Sub") || !strings.Contains(exploreText, "Base") || !strings.Contains(exploreText, "heritage") {
    t.Fatalf("query_nodes did not render the Sub -> Base heritage edge:\n%s", exploreText)
  }

  // query_diagnostics surfaces the type error with its tsc code.
  diag := toolText(t, server, `{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"query_diagnostics","arguments":{"files":["src/main.ts"]}}}`)
  if !strings.Contains(diag, "TS2322") {
    t.Fatalf("query_diagnostics did not surface the TS2322 error:\n%s", diag)
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
  names := map[string]bool{}
  for name := range toolsByName(t, list) {
    names[name] = true
  }
  return names
}

// toolsByName returns the advertised tools keyed by MCP tool name.
func toolsByName(t *testing.T, list map[string]any) map[string]map[string]any {
  t.Helper()
  tools, ok := list["tools"].([]any)
  if !ok {
    t.Fatalf("tools/list has no tools array: %v", list)
  }
  out := map[string]map[string]any{}
  for _, entry := range tools {
    tool, ok := entry.(map[string]any)
    if !ok {
      continue
    }
    if name, ok := tool["name"].(string); ok {
      out[name] = tool
    }
  }
  return out
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
