package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestNodesAreMarkedExportedThroughTheExportTable verifies that markExports flags
// a node as Exported from the checker's module export table, not from a syntactic
// `export` modifier — so a declaration exported by a separate `export { Service }`
// statement counts, while an unexported sibling does not.
//
// The export surface drives the public-API projection, and the codebases the
// graph targets export most of their surface through `export { … }` and barrel
// re-exports rather than inline modifiers. A modifier-only scan would miss
// Service here; the export-table walk must catch it, and must still leave the
// unexported Internal alone.
//
//  1. Compile a fixture declaring `class Service` and `class Internal`, exporting
//     only Service through a trailing `export { Service }` statement.
//  2. Build the graph.
//  3. Assert the Service node is Exported and the Internal node is not.
func TestNodesAreMarkedExportedThroughTheExportTable(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `class Service {}
class Internal {}
export { Service };
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

  service := graph.Nodes[nodeID(path, "Service", NodeClass)]
  internal := graph.Nodes[nodeID(path, "Internal", NodeClass)]
  if service == nil || internal == nil {
    t.Fatalf("Build did not record both classes; have %v", nodeIDSet(graph))
  }

  // Exported via a separate `export { Service }` statement — no inline modifier,
  // so only the checker export table reveals it.
  if !service.Exported {
    t.Fatalf("Service should be marked Exported through the export table")
  }
  // Negative twin: Internal is never exported, so the public-API projection must
  // not surface it.
  if internal.Exported {
    t.Fatalf("Internal is not exported but was marked Exported")
  }
}
