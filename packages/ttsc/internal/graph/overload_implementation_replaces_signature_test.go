package graph

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestOverloadImplementationReplacesSignature verifies that an overload set's
// graph node points at the executable implementation, not the first signature.
// Overload-heavy APIs otherwise force agents to re-open the file to see the
// calls that the graph already attributed to the node.
func TestOverloadImplementationReplacesSignature(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export class Query {
  join(name: string): this
  join(name: string, alias?: string): this {
    return this.realJoin(name, alias)
  }

  private realJoin(name: string, alias?: string): this {
    return this
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
  file := sourceFile(t, prog, "main.ts")
  path := file.FileName()
  id := nodeID(path, "Query.join", NodeMethod)
  node := graph.Nodes[id]
  if node == nil {
    t.Fatalf("missing node Query.join; have %v", nodeIDSet(graph))
  }
  source := file.Text()[node.Pos:node.End]
  if !strings.Contains(source, "return this.realJoin") {
    t.Fatalf("expected Query.join node to cover the implementation body, got:\n%s", source)
  }
  if !hasEdge(graph, id, nodeID(path, "Query.realJoin", NodeMethod), EdgeValueCall) {
    t.Fatalf("missing value-call edge Query.join -> Query.realJoin; edges: %v", graph.Edges)
  }
}
