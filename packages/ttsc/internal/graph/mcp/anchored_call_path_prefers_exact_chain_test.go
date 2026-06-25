package mcp

import (
  "reflect"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/graph"
)

// TestAnchoredCallPathPrefersExactChain verifies exact symbol anchors in a flow
// query are stitched through the graph before broad BFS expansion.
//
// When a user names the endpoints of a chain, the graph should return the actual
// value-flow path between those anchors rather than pulling in every sibling
// call from the first node.
//
//  1. Build a synthetic value-call graph with one on-chain branch and one
//     sibling branch from the public entry.
//  2. Ask for the exact public and terminal symbols.
//  3. Assert the selected flow follows the on-chain branch and omits the sibling.
func TestAnchoredCallPathPrefersExactChain(t *testing.T) {
  nodes := map[string]*graph.Node{
    "gateway":     {ID: "gateway", Name: "Gateway.fetch", Kind: graph.NodeMethod, File: "src/main.ts"},
    "coordinator": {ID: "coordinator", Name: "Coordinator.fetch", Kind: graph.NodeMethod, File: "src/main.ts"},
    "bridge":      {ID: "bridge", Name: "Coordinator.bridge", Kind: graph.NodeMethod, File: "src/main.ts"},
    "pipeline":    {ID: "pipeline", Name: "Pipeline.buildSteps", Kind: graph.NodeMethod, File: "src/main.ts"},
    "logger":      {ID: "logger", Name: "Logger.record", Kind: graph.NodeMethod, File: "src/main.ts"},
  }
  server := &Server{
    graph: &graph.Graph{Nodes: nodes},
    forwardCallAdj: map[string][]string{
      "gateway":     {"logger", "coordinator"},
      "coordinator": {"bridge"},
      "bridge":      {"pipeline"},
    },
  }
  seeds := []*graph.Node{nodes["gateway"], nodes["logger"], nodes["pipeline"]}
  gotNodes := server.withCallPath(seeds, maxPathNodes, "Trace Gateway.fetch to Pipeline.buildSteps")
  got := make([]string, 0, len(gotNodes))
  for _, node := range gotNodes {
    got = append(got, node.Name)
  }
  want := []string{
    "Gateway.fetch",
    "Coordinator.fetch",
    "Coordinator.bridge",
    "Pipeline.buildSteps",
  }
  if !reflect.DeepEqual(got, want) {
    t.Fatalf("withCallPath() = %#v; want %#v", got, want)
  }
}

// TestMatchNodesKeepsLongMemberAnchorsAfterDottedAnchors verifies a natural
// flow query does not discard later exact member names just because earlier
// owner/member anchors were found.
//
// Agents often ask with a partial chain like "Gateway fetch Coordinator
// setPlan applyPlan buildSteps". The first owner/member pair should anchor the
// path, but the later exact member tokens are still part of the requested route.
func TestMatchNodesKeepsLongMemberAnchorsAfterDottedAnchors(t *testing.T) {
  nodes := map[string]*graph.Node{
    "gateway":  {ID: "gateway", Name: "Gateway.fetch", Kind: graph.NodeMethod, File: "src/main.ts"},
    "manager":  {ID: "manager", Name: "Coordinator.fetch", Kind: graph.NodeMethod, File: "src/main.ts"},
    "set":      {ID: "set", Name: "Pipeline.setFindOptions", Kind: graph.NodeMethod, File: "src/main.ts"},
    "apply":    {ID: "apply", Name: "Pipeline.applyFindOptions", Kind: graph.NodeMethod, File: "src/main.ts"},
    "build":    {ID: "build", Name: "Pipeline.buildRelations", Kind: graph.NodeMethod, File: "src/main.ts"},
    "relations": {ID: "relations", Name: "Pipeline.relations", Kind: graph.NodeVariable, File: "src/main.ts"},
    "unrelated": {ID: "unrelated", Name: "Other.create", Kind: graph.NodeMethod, File: "src/main.ts"},
  }
  server := &Server{graph: &graph.Graph{Nodes: nodes}}
  query := "Gateway fetch Coordinator setFindOptions applyFindOptions buildRelations relations"
  matches := server.matchNodes(query)
  got := map[string]bool{}
  for _, node := range matches {
    got[node.Name] = true
  }
  for _, want := range []string{
    "Gateway.fetch",
    "Coordinator.fetch",
    "Pipeline.setFindOptions",
    "Pipeline.applyFindOptions",
    "Pipeline.buildRelations",
  } {
    if !got[want] {
      t.Fatalf("matchNodes omitted %s from mixed anchor/member query; got %#v", want, namesOf(matches))
    }
  }
  if got["Other.create"] {
    t.Fatalf("matchNodes pulled unrelated short member noise into mixed anchor/member query; got %#v", namesOf(matches))
  }
  route := map[string]bool{}
  for _, node := range server.withCallPath(matches, maxPathNodes, query) {
    route[node.Name] = true
  }
  if route["Pipeline.relations"] {
    t.Fatalf("withCallPath promoted a data property to a bare member flow anchor; got %#v", namesOf(server.withCallPath(matches, maxPathNodes, query)))
  }
}

func namesOf(nodes []*graph.Node) []string {
  names := make([]string, 0, len(nodes))
  for _, node := range nodes {
    names = append(names, node.Name)
  }
  return names
}
