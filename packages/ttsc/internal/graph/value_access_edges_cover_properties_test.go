package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestValueAccessEdgesCoverPropertiesAndAccessors verifies property and
// accessor reads/writes become value-access edges, not value-call edges.
//
// Lazy getters and state properties are part of the runtime flow an agent
// needs, but they are not invocations. The graph must expose them without
// corrupting call-flow semantics.
//
//  1. Compile a class with a property initializer, getter, setter, dotted access,
//     and string-literal bracket access.
//  2. Build the graph.
//  3. Assert property/getter/setter uses are value-access edges while the
//     property initializer's real function call stays a value-call edge.
//
// @evidence contracts/testing.md#behavioral-verification Verifies property and accessor reads/writes become value-access edges, not value-call edges.
// @evidence contracts/testing.md#independent-expectations The explicit input facts and supported graph/command contract establish property/getter/setter uses are value-access edges while the property initializer's real function call stays a value-call edge.
// @evidence contracts/testing.md#distinguishing-cases Compile a class with a property initializer, getter, setter, dotted access, and string-literal bracket access; Build the graph; Assert property/getter/setter uses are value-access edges while the property initializer's real function call stays a value-call edge.
// @evidence contracts/testing.md#execution-ownership TestValueAccessEdgesCoverPropertiesAndAccessors is a Go source-unit entry. Build, nodeID execute directly over the authored source or explicit input facts. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary.
func TestValueAccessEdgesCoverPropertiesAndAccessors(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export function seed(): string[] {
  return []
}

export class Store {
  protected items: string[] = seed()

  get count(): number {
    return this.items.length
  }

  set count(value: number) {
    this.items = Array(value).fill("")
  }

  read(): number {
    return this.count + this.items.length + this["count"] + this["items"].length
  }

  write(): void {
    this.count = 1
    this["count"] = 2
    this.items = []
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
  path := sourceFile(t, prog, "main.ts").FileName()
  read := nodeID(path, "Store.read", NodeMethod)
  write := nodeID(path, "Store.write", NodeMethod)
  count := nodeID(path, "Store.count", NodeMethod)
  items := nodeID(path, "Store.items", NodeVariable)
  seed := nodeID(path, "seed", NodeFunction)

  if _, ok := graph.Nodes[items]; !ok {
    t.Fatalf("Build did not record Store.items; have %v", nodeIDSet(graph))
  }
  if !hasEdge(graph, read, count, EdgeValueAccess) {
    t.Fatalf("missing value-access edge Store.read -> Store.count; edges: %v", graph.Edges)
  }
  if !hasEdge(graph, read, items, EdgeValueAccess) {
    t.Fatalf("missing value-access edge Store.read -> Store.items; edges: %v", graph.Edges)
  }
  if !hasEdge(graph, count, items, EdgeValueAccess) {
    t.Fatalf("missing value-access edge Store.count -> Store.items; edges: %v", graph.Edges)
  }
  if !hasEdge(graph, write, count, EdgeValueAccess) {
    t.Fatalf("missing value-access edge Store.write -> Store.count; edges: %v", graph.Edges)
  }
  if !hasEdge(graph, write, items, EdgeValueAccess) {
    t.Fatalf("missing value-access edge Store.write -> Store.items; edges: %v", graph.Edges)
  }
  if !hasEdge(graph, items, seed, EdgeValueCall) {
    t.Fatalf("missing value-call edge Store.items -> seed; edges: %v", graph.Edges)
  }
  if hasEdge(graph, read, count, EdgeValueCall) {
    t.Fatalf("getter read was also recorded as value-call Store.read -> Store.count; edges: %v", graph.Edges)
  }
  if hasEdge(graph, write, count, EdgeValueCall) {
    t.Fatalf("setter write was also recorded as value-call Store.write -> Store.count; edges: %v", graph.Edges)
  }
}
