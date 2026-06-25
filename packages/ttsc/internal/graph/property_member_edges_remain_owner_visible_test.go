package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestPropertyMemberEdgesRemainOwnerVisible verifies property-member nodes are
// additive rather than replacing class/interface owner-level edges.
//
// Property nodes give MCP precise evidence for state/property flows, but broad
// architecture questions still need `Service -> Dep` and `Service -> makeDep`
// without already knowing `Service.dep`.
//
//  1. Compile a class property with both a type reference and initializer call,
//     plus an interface property signature.
//  2. Build the graph.
//  3. Assert both the owner node and the property node expose the same
//     dependency evidence.
func TestPropertyMemberEdgesRemainOwnerVisible(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export interface Dep {
  value: string
}

export function makeDep(): Dep {
  return { value: "ok" }
}

export class Service {
  dep: Dep = makeDep()
}

export interface Contract {
  dep: Dep
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
  dep := nodeID(path, "Dep", NodeInterface)
  makeDep := nodeID(path, "makeDep", NodeFunction)
  service := nodeID(path, "Service", NodeClass)
  serviceDep := nodeID(path, "Service.dep", NodeVariable)
  contract := nodeID(path, "Contract", NodeInterface)
  contractDep := nodeID(path, "Contract.dep", NodeVariable)

  for _, id := range []string{serviceDep, contractDep} {
    if _, ok := graph.Nodes[id]; !ok {
      t.Fatalf("missing property node %s; nodes: %v", id, nodeIDSet(graph))
    }
  }
  if !hasEdge(graph, serviceDep, dep, EdgeTypeRef) {
    t.Fatalf("missing type-ref edge Service.dep -> Dep; edges: %v", graph.Edges)
  }
  if !hasEdge(graph, serviceDep, makeDep, EdgeValueCall) {
    t.Fatalf("missing value-call edge Service.dep -> makeDep; edges: %v", graph.Edges)
  }
  if !hasEdge(graph, service, dep, EdgeTypeRef) {
    t.Fatalf("missing owner type-ref edge Service -> Dep; edges: %v", graph.Edges)
  }
  if !hasEdge(graph, service, makeDep, EdgeValueCall) {
    t.Fatalf("missing owner value-call edge Service -> makeDep; edges: %v", graph.Edges)
  }
  if !hasEdge(graph, contractDep, dep, EdgeTypeRef) {
    t.Fatalf("missing type-ref edge Contract.dep -> Dep; edges: %v", graph.Edges)
  }
  if !hasEdge(graph, contract, dep, EdgeTypeRef) {
    t.Fatalf("missing owner type-ref edge Contract -> Dep; edges: %v", graph.Edges)
  }
}
