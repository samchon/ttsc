package graph

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEdgeSpansPointToResolvedUsage checks the selected caller-to-helper and
// Box.read-to-Box.value spans against literal fixture text. Repeated-use
// deduplication, first-use selection and consumer reopening are not exercised.
//
// 1. Load adjacent helper and helperShadow declarations plus Box.value and Box.read.
// 2. Resolve the caller-to-helper call and the read-to-value access edges.
// 3. Require the call slice to equal helper and the access slice to contain this.value, rather than a nearby declaration name.
//
// @evidence contracts/testing.md#behavioral-verification Require the call slice to equal helper and the access slice to contain this.value, rather than a nearby declaration name.
// @evidence contracts/testing.md#independent-expectations The selected call's actual source slice, after TrimSpace, must equal literal helper rather than helperShadow; the selected read-to-value slice must contain literal this.value. The offsets come from the graph under test, so these text checks do not authenticate exact whitespace boundaries or independently derive byte coordinates.
// @evidence contracts/testing.md#distinguishing-cases Load adjacent helper and helperShadow declarations plus Box.value and Box.read. Resolve the caller-to-helper call and the read-to-value access edges. Require the call slice to equal helper and the access slice to contain this.value, rather than a nearby declaration name.
// @evidence contracts/testing.md#execution-ownership This Go source-unit writes a native project, constructs/closes its driver Program in-process and directly builds its graph. Local name/kind helpers select actual graph nodes and edge triples before slicing actual Program text. A restored empty linked-plugin manifest excludes ambient hooks; no dump serialization, installed consumer or product process runs.
func TestEdgeSpansPointToResolvedUsage(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
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
