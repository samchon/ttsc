package graph

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEdgeSpansPointToResolvedUsage verifies each checker-resolved edge keeps
// the source expression that produced it. The edge is still deduped by
// from/to/kind, but MCP needs the first concrete use span so a truncated
// declaration can reopen the right line without string-searching for a target
// name that may appear elsewhere.
func TestEdgeSpansPointToResolvedUsage(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  path := filepath.Join(root, "src", "main.ts")
  writeFile(t, path, `export function helper(): number {
  return 1;
}

export function caller(): number {
  const helperShadow = 0;
  return helper() + helperShadow;
}

export class Box {
  value = 1;

  read(): number {
    return this.value;
  }
}
`)

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %v", diags)
  }
  defer func() { _ = prog.Close() }()

  graph := Build(prog)
  caller := nodeByName(graph, "caller", NodeFunction)
  helper := nodeByName(graph, "helper", NodeFunction)
  read := nodeByName(graph, "Box.read", NodeMethod)
  value := nodeByName(graph, "Box.value", NodeVariable)
  if caller == nil || helper == nil || read == nil || value == nil {
    t.Fatalf("missing fixture nodes: caller=%v helper=%v read=%v value=%v", caller, helper, read, value)
  }
  source := prog.SourceFile(caller.File).Text()

  call := findEdge(graph, caller.ID, helper.ID, EdgeValueCall)
  if call == nil {
    t.Fatalf("missing caller -> helper value-call edge; edges: %v", graph.Edges)
  }
  if got := strings.TrimSpace(source[call.Pos:call.End]); got != "helper" {
    t.Fatalf("value-call span = %q, want helper", got)
  }

  access := findEdge(graph, read.ID, value.ID, EdgeValueAccess)
  if access == nil {
    t.Fatalf("missing Box.read -> Box.value value-access edge; edges: %v", graph.Edges)
  }
  if got := source[access.Pos:access.End]; !strings.Contains(got, "this.value") {
    t.Fatalf("value-access span = %q, want this.value expression", got)
  }
}

func nodeByName(graph *Graph, name string, kind NodeKind) *Node {
  for _, node := range graph.Nodes {
    if node.Name == name && node.Kind == kind {
      return node
    }
  }
  return nil
}

func findEdge(graph *Graph, from, to string, kind EdgeKind) *Edge {
  for _, edge := range graph.Edges {
    if edge.From == from && edge.To == to && edge.Kind == kind {
      return edge
    }
  }
  return nil
}
