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
	if text, _ := init["instructions"].(string); !strings.Contains(text, "query_exports") || !strings.Contains(text, "query_flow") || !strings.Contains(text, "query_path") || !strings.Contains(text, "query_nodes") {
		t.Fatalf("initialize did not ship server instructions: %v", init["instructions"])
	}

	// A notification (no id) draws no reply.
	if out, ok := server.Handle([]byte(`{"jsonrpc":"2.0","method":"notifications/initialized"}`)); ok {
		t.Fatalf("a notification drew a reply: %s", out)
	}

	// tools/list advertises the graph tools.
	list := result(t, server, `{"jsonrpc":"2.0","id":2,"method":"tools/list"}`)
	names := toolNames(t, list)
	if !names["query_exports"] || !names["query_flow"] || !names["query_path"] || !names["query_nodes"] || !names["expand_nodes"] || !names["query_files"] || !names["query_diagnostics"] {
		t.Fatalf("tools/list missing expected tools: %v", names)
	}
	tools := toolsByName(t, list)
	exports := tools["query_exports"]
	if desc, _ := exports["description"].(string); !strings.Contains(desc, "onboarding") {
		t.Fatalf("query_exports did not use the embedded description: %v", desc)
	}
	exportsSchema := exports["inputSchema"].(map[string]any)
	exportsProperties := exportsSchema["properties"].(map[string]any)
	exportsQuery := exportsProperties["query"].(map[string]any)
	if desc, _ := exportsQuery["description"].(string); !strings.Contains(desc, "Optional filter") {
		t.Fatalf("query_exports query did not use the embedded description: %v", desc)
	}
	exportsLimit := exportsProperties["limit"].(map[string]any)
	if exportsLimit["type"] != "integer" || exportsLimit["minimum"] != float64(0) || exportsLimit["default"] != float64(100) || exportsLimit["maximum"] != float64(10000) {
		t.Fatalf("query_exports limit schema was not bounded with defaults: %v", exportsLimit)
	}
	exportsPage := exportsProperties["page"].(map[string]any)
	if exportsPage["type"] != "integer" || exportsPage["minimum"] != float64(1) || exportsPage["default"] != float64(1) {
		t.Fatalf("query_exports page schema was not bounded with defaults: %v", exportsPage)
	}
	exportsOutput := exports["outputSchema"].(map[string]any)
	assertNoOutputEchoFields(t, exportsOutput, "schemaVersion", "tool", "query", "currentPage", "pageSize")
	exportsDefs := exportsOutput["$defs"].(map[string]any)
	if exportsDefs["QueryExportsPage"] == nil || exportsDefs["QueryExportSymbol"] == nil {
		t.Fatalf("query_exports output schema did not expose named defs: %v", exportsDefs)
	}
	exportSymbol := exportsDefs["QueryExportSymbol"].(map[string]any)
	exportSymbolProperties := exportSymbol["properties"].(map[string]any)
	assertStringEnum(t, exportSymbolProperties["kind"].(map[string]any), "class", "interface", "method")
	nodes := tools["query_nodes"]
	if desc, _ := nodes["description"].(string); !strings.Contains(desc, "relationship discovery") {
		t.Fatalf("query_nodes did not use the embedded description: %v", desc)
	}
	nodesSchema := nodes["inputSchema"].(map[string]any)
	nodesProperties := nodesSchema["properties"].(map[string]any)
	queryProperty := nodesProperties["query"].(map[string]any)
	if desc, _ := queryProperty["description"].(string); !strings.Contains(desc, "Focused relationship") {
		t.Fatalf("query_nodes query did not use the embedded description: %v", desc)
	}
	matchProperty := nodesProperties["match"].(map[string]any)
	if desc, _ := matchProperty["description"].(string); !strings.Contains(desc, "exact") {
		t.Fatalf("query_nodes match did not describe exact matching: %v", desc)
	}
	nodesOutput := nodes["outputSchema"].(map[string]any)
	assertNoOutputEchoFields(t, nodesOutput, "schemaVersion", "tool", "query", "mode", "match")
	nodesDefs := nodesOutput["$defs"].(map[string]any)
	if nodesDefs["QueryGraphNode"] == nil || nodesDefs["QueryEdgeRef"] == nil {
		t.Fatalf("query_nodes output schema did not expose graph defs: %v", nodesDefs)
	}
	edgeRef := nodesDefs["QueryEdgeRef"].(map[string]any)
	edgeRefProperties := edgeRef["properties"].(map[string]any)
	assertStringEnum(t, edgeRefProperties["kind"].(map[string]any), "heritage", "value-call", "value-access", "type-ref")
	flow := tools["query_flow"]
	if desc, _ := flow["description"].(string); !strings.Contains(desc, "Natural-language call-flow discovery") {
		t.Fatalf("query_flow did not use the embedded description: %v", desc)
	}
	flowSchema := flow["inputSchema"].(map[string]any)
	flowProperties := flowSchema["properties"].(map[string]any)
	flowQuery := flowProperties["query"].(map[string]any)
	if desc, _ := flowQuery["description"].(string); !strings.Contains(desc, "Natural-language task terms") {
		t.Fatalf("query_flow query did not use the embedded description: %v", desc)
	}
	flowOutput := flow["outputSchema"].(map[string]any)
	assertNoOutputEchoFields(t, flowOutput, "schemaVersion", "tool", "query")
	flowDefs := flowOutput["$defs"].(map[string]any)
	if flowDefs["ExpandedNode"] == nil || flowDefs["QueryFlow"] == nil {
		t.Fatalf("query_flow output schema did not expose flow defs: %v", flowDefs)
	}
	pathTool := tools["query_path"]
	if desc, _ := pathTool["description"].(string); !strings.Contains(desc, "start and end symbol") {
		t.Fatalf("query_path did not use the embedded description: %v", desc)
	}
	pathSchema := pathTool["inputSchema"].(map[string]any)
	pathProperties := pathSchema["properties"].(map[string]any)
	if desc, _ := pathProperties["from"].(map[string]any)["description"].(string); !strings.Contains(desc, "Start symbol") {
		t.Fatalf("query_path from did not use the embedded description: %v", desc)
	}
	if desc, _ := pathProperties["via"].(map[string]any)["description"].(string); !strings.Contains(desc, "intermediate") {
		t.Fatalf("query_path via did not use the embedded description: %v", desc)
	}
	pathOutput := pathTool["outputSchema"].(map[string]any)
	assertNoOutputEchoFields(t, pathOutput, "schemaVersion", "tool", "from", "to", "via", "missing")
	pathDefs := pathOutput["$defs"].(map[string]any)
	if pathDefs["QueryPathNode"] == nil || pathDefs["QueryPathEdge"] == nil {
		t.Fatalf("query_path output schema did not expose named defs: %v", pathDefs)
	}
	pathNode := pathDefs["QueryPathNode"].(map[string]any)
	pathNodeProperties := pathNode["properties"].(map[string]any)
	if _, ok := pathNodeProperties["external"]; ok {
		t.Fatalf("query_path node schema leaked external flag despite in-project path filtering: %v", pathNodeProperties)
	}
	assertStringEnum(t, pathNodeProperties["kind"].(map[string]any), "class", "interface", "method")
	expand := tools["expand_nodes"]
	if desc, _ := expand["description"].(string); !strings.Contains(desc, "Exact source expansion") {
		t.Fatalf("expand_nodes did not use the embedded description: %v", desc)
	}
	expandOutput := expand["outputSchema"].(map[string]any)
	assertNoOutputEchoFields(t, expandOutput, "schemaVersion", "tool", "mode")
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
	diagnosticsOutput := diagnostics["outputSchema"].(map[string]any)
	assertNoOutputEchoFields(t, diagnosticsOutput, "schemaVersion", "tool", "severity", "scope")

	// query_nodes returns structured graph edges for Sub.
	explore := toolStructured(t, server, `{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"query_nodes","arguments":{"query":"Sub","match":"exact"}}}`)
	if explore["totalMatches"] != float64(1) {
		t.Fatalf("query_nodes structured result had wrong match count: %v", explore)
	}
	if !structuredContains(explore, "Sub") || !structuredContains(explore, "Base") || !structuredContains(explore, "heritage") {
		t.Fatalf("query_nodes did not return the Sub -> Base heritage edge:\n%v", explore)
	}

	// query_diagnostics surfaces the type error with its tsc code.
	diag := toolStructured(t, server, `{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"query_diagnostics","arguments":{"files":["src/main.ts"]}}}`)
	if !structuredContains(diag, "TS2322") {
		t.Fatalf("query_diagnostics did not surface the TS2322 error:\n%v", diag)
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

// toolText drives a tools/call request and returns structuredContent serialized
// for legacy substring assertions in older MCP tests.
func toolText(t *testing.T, server *mcp.Server, message string) string {
	t.Helper()
	res := result(t, server, message)
	assertShortToolContent(t, res)
	structured, ok := res["structuredContent"]
	if !ok {
		t.Fatalf("tools/call result had no structuredContent: %v", res)
	}
	bytes, err := json.MarshalIndent(structured, "", "  ")
	if err != nil {
		t.Fatalf("structuredContent could not be serialized: %v", err)
	}
	return string(bytes)
}

func toolStructured(t *testing.T, server *mcp.Server, message string) map[string]any {
	t.Helper()
	res := result(t, server, message)
	assertShortToolContent(t, res)
	structured, ok := res["structuredContent"].(map[string]any)
	if !ok {
		t.Fatalf("tools/call result had no structuredContent object: %v", res)
	}
	return structured
}

func assertShortToolContent(t *testing.T, res map[string]any) {
	t.Helper()
	content, ok := res["content"].([]any)
	if !ok || len(content) != 1 {
		t.Fatalf("tools/call content must be exactly one short text block: %v", res["content"])
	}
	block, ok := content[0].(map[string]any)
	if !ok || block["type"] != "text" {
		t.Fatalf("tools/call content block is not text: %v", content[0])
	}
	text, ok := block["text"].(string)
	if !ok || strings.TrimSpace(text) == "" || len(text) > 160 {
		t.Fatalf("tools/call content summary is empty or too long: %q", text)
	}
	if strings.Contains(text, "{") || strings.Contains(text, `"nodes"`) || strings.Contains(text, `"exports"`) || strings.Contains(text, `"diagnostics"`) {
		t.Fatalf("tools/call content duplicated structured payload data: %q", text)
	}
}

func structuredContains(value any, needle string) bool {
	switch v := value.(type) {
	case string:
		return strings.Contains(v, needle)
	case []any:
		for _, item := range v {
			if structuredContains(item, needle) {
				return true
			}
		}
	case map[string]any:
		for _, item := range v {
			if structuredContains(item, needle) {
				return true
			}
		}
	}
	return false
}

func assertNoOutputEchoFields(t *testing.T, schema map[string]any, names ...string) {
	t.Helper()
	properties, ok := schema["properties"].(map[string]any)
	if !ok {
		t.Fatalf("output schema has no properties object: %v", schema)
	}
	for _, name := range names {
		if _, ok := properties[name]; ok {
			t.Fatalf("output schema echoes %q: %v", name, properties)
		}
	}
}

func assertStringEnum(t *testing.T, schema map[string]any, values ...string) {
	t.Helper()
	if schema["type"] != "string" {
		t.Fatalf("schema is not a string enum: %v", schema)
	}
	raw, ok := schema["enum"].([]any)
	if !ok {
		t.Fatalf("schema has no enum: %v", schema)
	}
	found := map[string]bool{}
	for _, item := range raw {
		if value, ok := item.(string); ok {
			found[value] = true
		}
	}
	for _, value := range values {
		if !found[value] {
			t.Fatalf("enum missing %q: %v", value, raw)
		}
	}
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
