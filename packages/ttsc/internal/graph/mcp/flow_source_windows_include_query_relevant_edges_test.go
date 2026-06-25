package mcp

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/graph"
)

// TestFlowSourceWindowsIncludeQueryRelevantEdges verifies flow source windows
// include local value-use evidence that matches the query even when the target
// node is not part of the selected path node set.
//
// Flow rendering is an index answer, not just a list of already-selected nodes.
// If a known declaration has a checker-resolved call/access at the relevant line,
// the window should expose that evidence so an agent does not reopen the same
// body with expand_nodes or shell reads.
//
//  1. Render a long source body with one included path edge and one off-path edge
//     whose target name matches the query.
//  2. Assert the path edge and query-relevant off-path edge both appear.
//  3. Assert an unrelated off-path edge remains omitted.
func TestFlowSourceWindowsIncludeQueryRelevantEdges(t *testing.T) {
  source := strings.Join([]string{
    "function route(request: Request) {",
    "  const first = normalize(request);",
    "  const alias = aliasFactory(request);",
    "  const filler0 = 0;",
    "  const filler1 = 1;",
    "  const filler2 = 2;",
    "  const filler3 = 3;",
    "  const filler4 = 4;",
    "  const ignored = unrelated(request);",
    "  return first + alias + ignored;",
    "}",
  }, "\n")
  pos := func(needle string) int {
    idx := strings.Index(source, needle)
    if idx < 0 {
      t.Fatalf("missing %q in source fixture", needle)
    }
    return idx
  }
  route := &graph.Node{ID: "route", Name: "Router.route", Kind: graph.NodeFunction, File: "src/main.ts"}
  normalize := &graph.Node{ID: "normalize", Name: "Pipeline.normalize", Kind: graph.NodeFunction, File: "src/main.ts"}
  alias := &graph.Node{ID: "alias", Name: "AliasFactory.aliasFactory", Kind: graph.NodeFunction, File: "src/main.ts"}
  unrelated := &graph.Node{ID: "unrelated", Name: "Telemetry.record", Kind: graph.NodeFunction, File: "src/main.ts"}
  server := &Server{
    graph: &graph.Graph{
      Nodes: map[string]*graph.Node{
        route.ID:      route,
        normalize.ID:  normalize,
        alias.ID:      alias,
        unrelated.ID:  unrelated,
      },
      Edges: []*graph.Edge{
        {From: route.ID, To: normalize.ID, Kind: graph.EdgeValueCall, Pos: pos("normalize"), End: pos("normalize") + len("normalize")},
        {From: route.ID, To: alias.ID, Kind: graph.EdgeValueCall, Pos: pos("aliasFactory"), End: pos("aliasFactory") + len("aliasFactory")},
        {From: route.ID, To: unrelated.ID, Kind: graph.EdgeValueCall, Pos: pos("unrelated"), End: pos("unrelated") + len("unrelated")},
      },
    },
  }
  included := map[string]bool{
    route.ID:     true,
    normalize.ID: true,
  }
  var b strings.Builder
  server.writeFlowSourceWindows(&b, route, included, source, 10, 0, "route alias request")
  text := b.String()
  if !strings.Contains(text, "const first = normalize(request);") {
    t.Fatalf("flow window omitted included path edge:\n%s", text)
  }
  if !strings.Contains(text, "const alias = aliasFactory(request);") {
    t.Fatalf("flow window omitted query-relevant off-path edge:\n%s", text)
  }
  if strings.Contains(text, "const ignored = unrelated(request);") {
    t.Fatalf("flow window included unrelated off-path edge:\n%s", text)
  }
}
