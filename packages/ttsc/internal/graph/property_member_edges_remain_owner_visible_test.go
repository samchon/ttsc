package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestPropertyMemberEdgesRemainOwnerVisible verifies property-member nodes are
// additive rather than replacing class/interface owner-level edges.
//
// This authored class and interface require both property-level and owner-level
// dependency triples. No MCP consumer or architecture-query result is observed,
// and the assertions do not compare source spans or exact edge counts.
//
//  1. Compile a class property with both a type reference and initializer call,
//     plus an interface property signature.
//  2. Build the graph.
//  3. Assert both the owner node and the property node expose the same
//     dependency evidence.
//
// @evidence contracts/testing.md#behavioral-verification Verifies property-member nodes are additive rather than replacing class/interface owner-level edges.
// @evidence contracts/testing.md#independent-expectations The expectations are literal over Service.dep and Contract.dep: the property nodes must exist and carry type-ref edges to Dep (and Service.dep a value-call edge to makeDep), and the owners Service and Contract must carry the same type-ref edges and Service the value-call edge, so adding property nodes does not remove owner-level edges.
// @evidence contracts/testing.md#distinguishing-cases Compile a class property with both a type reference and initializer call, plus an interface property signature; Build the graph; Assert both the owner node and the property node expose the same dependency evidence.
// @evidence contracts/testing.md#execution-ownership Owns temporary native config/source files and a directly loaded library Program, closes it, and restores an empty linked-plugin manifest. Build and six edge-presence observations run in this process; node selection shares the actual Program filename and nodeID encoder. No independent identity oracle, consumer installation, product CLI, MCP query, or emitted initializer execution runs.
func TestPropertyMemberEdgesRemainOwnerVisible(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
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
  dep := nodeID(path.AsString(), "Dep", NodeInterface)
  makeDep := nodeID(path.AsString(), "makeDep", NodeFunction)
  service := nodeID(path.AsString(), "Service", NodeClass)
  serviceDep := nodeID(path.AsString(), "Service.dep", NodeVariable)
  contract := nodeID(path.AsString(), "Contract", NodeInterface)
  contractDep := nodeID(path.AsString(), "Contract.dep", NodeVariable)

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
