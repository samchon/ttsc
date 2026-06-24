package mcp_test

import (
  "fmt"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph/mcp"
)

// TestExpandNodesReopensBudgetedHandles verifies collapsed query_nodes results
// carry exact handles that expand_nodes can reopen without fuzzy search.
//
// This pins the MCP contract that replaces the old "omitted source => grep/read"
// fallback. A coding agent can now keep using graph handles when the TypeScript
// declaration is known but its body was omitted by the response budget.
//
//  1. Compile enough similarly named declarations to force query_nodes to render
//     at least one result as a signature-only collapsed node.
//  2. Capture that node's printed handle.
//  3. Assert expand_nodes returns the omitted declaration body.
func TestExpandNodesReopensBudgetedHandles(t *testing.T) {
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
  var src strings.Builder
  for i := 0; i < 12; i++ {
    name := fmt.Sprintf("clusterTarget%02d", i)
    fmt.Fprintf(&src, "export function %s(): string {\n", name)
    fmt.Fprintf(&src, "  const marker = %q\n", name+"-body-marker")
    for j := 0; j < 34; j++ {
      fmt.Fprintf(&src, "  const value%d = %d\n", j, j)
    }
    src.WriteString("  return marker\n")
    src.WriteString("}\n\n")
  }
  writeFile(t, filepath.Join(root, "src", "main.ts"), src.String())

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %v", diags)
  }
  defer func() { _ = prog.Close() }()

  server := mcp.NewServer(prog)
  text := toolText(t, server, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"query_nodes","arguments":{"query":"clusterTarget"}}}`)
  handle, marker := collapsedHandle(t, text)
  expanded := toolText(t, server, fmt.Sprintf(`{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"expand_nodes","arguments":{"ids":[%q]}}}`, handle))
  if !strings.Contains(expanded, marker) {
    t.Fatalf("expand_nodes did not return omitted body marker %q for %s:\n%s", marker, handle, expanded)
  }
}

// TestExpandNodesReturnsWiderExactSource verifies exact expansion is wider than
// discovery. query_nodes should stay compact, but once an agent has a handle it
// must not need a shell read just to inspect the later half of a known method.
func TestExpandNodesReturnsWiderExactSource(t *testing.T) {
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
  var src strings.Builder
  src.WriteString("export function exactWideBody(): string {\n")
  for i := 0; i < 70; i++ {
    fmt.Fprintf(&src, "  const value%d = %q\n", i, fmt.Sprintf("value-%d", i))
  }
  src.WriteString("  const marker = \"EXPAND_NODES_WIDE_SOURCE_MARKER\"\n")
  src.WriteString("  return marker\n")
  src.WriteString("}\n")
  writeFile(t, filepath.Join(root, "src", "main.ts"), src.String())

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %v", diags)
  }
  defer func() { _ = prog.Close() }()

  server := mcp.NewServer(prog)
  text := toolText(t, server, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"query_nodes","arguments":{"query":"exactWideBody"}}}`)
  const marker = "EXPAND_NODES_WIDE_SOURCE_MARKER"
  if strings.Contains(text, marker) {
    t.Fatalf("query_nodes discovery unexpectedly included late marker:\n%s", text)
  }
  handle := nodeHandleFromText(t, text, "function exactWideBody")
  expanded := toolText(t, server, fmt.Sprintf(`{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"expand_nodes","arguments":{"ids":[%q]}}}`, handle))
  if !strings.Contains(expanded, marker) {
    t.Fatalf("expand_nodes did not return wider exact source for %s:\n%s", handle, expanded)
  }
}

func collapsedHandle(t *testing.T, text string) (string, string) {
  t.Helper()
  for _, line := range strings.Split(text, "\n") {
    if !strings.HasPrefix(line, "function clusterTarget") || !strings.Contains(line, "handle:n:") {
      continue
    }
    fields := strings.Fields(line)
    if len(fields) < 2 {
      continue
    }
    marker := fields[1] + "-body-marker"
    if strings.Contains(text, marker) {
      continue
    }
    for _, field := range fields {
      if strings.HasPrefix(field, "handle:n:") {
        return field, marker
      }
    }
  }
  t.Fatalf("query_nodes did not produce a collapsed function with handle:\n%s", text)
  return "", ""
}

func nodeHandleFromText(t *testing.T, text string, prefix string) string {
  t.Helper()
  for _, line := range strings.Split(text, "\n") {
    if !strings.HasPrefix(line, prefix) || !strings.Contains(line, "handle:n:") {
      continue
    }
    for _, field := range strings.Fields(line) {
      if strings.HasPrefix(field, "handle:n:") {
        return field
      }
    }
  }
  t.Fatalf("result did not contain handle for %s:\n%s", prefix, text)
  return ""
}
