package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestValueAccessEdgesCoverPropertiesAndAccessors verifies property and
// accessor reads/writes become value-access edges, not value-call edges.
//
// The mixed dotted/bracket fixture observes five selected access triples and
// one initializer-call triple, with two negative accessor-call controls.
// Dotted and bracket uses share endpoints, and getter/setter share one node,
// so these deduplicated edges do not independently authenticate each syntax or
// accessor body. No runtime flow or downstream agent query executes.
//
//  1. Compile a class with a property initializer, getter, setter, dotted access,
//     and string-literal bracket access.
//  2. Build the graph.
//  3. Assert property/getter/setter uses are value-access edges while the
//     property initializer's real function call stays a value-call edge.
//
// @evidence contracts/testing.md#behavioral-verification Requires five selected value-access triples and the Store.items-to-seed value-call, and rejects read/write-to-count value-calls. Shared endpoints limit independent dotted-versus-bracket and getter-versus-setter attribution; no exact counts, spans, runtime effects, or downstream consumer are asserted.
// @evidence contracts/testing.md#independent-expectations The expectations are literal over class Store: value-access edges must exist from Store.read to Store.count and Store.items, from Store.count to Store.items, and from Store.write to Store.count and Store.items (dotted and string-literal bracket forms, getter and setter); a value-call edge must run from Store.items to seed; and no value-call edge may run from Store.read or Store.write to Store.count.
// @evidence contracts/testing.md#distinguishing-cases Compile a class with a property initializer, getter, setter, dotted access, and string-literal bracket access; Build the graph; Assert property/getter/setter uses are value-access edges while the property initializer's real function call stays a value-call edge.
// @evidence contracts/testing.md#execution-ownership Owns temporary native config/source files and a directly loaded library Program, closes it, and restores an empty linked-plugin manifest. Build and literal edge-presence observations run in this process using its actual filename and shared nodeID encoder. No independent identity oracle, product CLI, installation, emitted getter/setter evaluation, or agent query runs.
func TestValueAccessEdgesCoverPropertiesAndAccessors(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
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
  read := nodeID(path.AsString(), "Store.read", NodeMethod)
  write := nodeID(path.AsString(), "Store.write", NodeMethod)
  count := nodeID(path.AsString(), "Store.count", NodeMethod)
  items := nodeID(path.AsString(), "Store.items", NodeVariable)
  seed := nodeID(path.AsString(), "seed", NodeFunction)

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
