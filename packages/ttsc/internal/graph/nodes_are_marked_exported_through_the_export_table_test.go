package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestNodesAreMarkedExportedThroughTheExportTable checks the Exported flags of
// two resident class nodes. Service is exported by a separate export statement;
// Internal remains unexported. This distinguishes an inline-modifier-only scan,
// without authenticating the acquisition algorithm or a public-API consumer.
//
//  1. Compile a fixture declaring `class Service` and `class Internal`, exporting
//     only Service through a trailing `export { Service }` statement.
//  2. Build the graph.
//  3. Assert the Service node is Exported and the Internal node is not.
//
// @evidence contracts/testing.md#behavioral-verification Requires both class nodes to exist, then checks Service.Exported true and Internal.Exported false for a separate export statement. It does not assert export edges, barrel resolution, public-API projection, or exclusive use of the checker table.
// @evidence contracts/testing.md#independent-expectations The expectations are literal over classes Service and Internal with only export { Service } at the end: the Service node must have Exported true and the Internal node Exported false, which a scan for an inline export modifier would get wrong for Service.
// @evidence contracts/testing.md#distinguishing-cases Compile a fixture declaring `class Service` and `class Internal`, exporting only Service through a trailing `export { Service }` statement; Build the graph; Assert the Service node is Exported and the Internal node is not.
// @evidence contracts/testing.md#execution-ownership Owns temporary native config/source files and a directly loaded library Program, closes the Program, and restores an empty linked-plugin manifest. Build and flag observations execute in this process; node selection uses the actual Program filename and shared nodeID encoder, not an independent identity oracle. No consumer installation, product CLI, or emitted JavaScript is executed.
func TestNodesAreMarkedExportedThroughTheExportTable(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
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

  // The separate export statement must affect this resident class node.
  if !service.Exported {
    t.Fatalf("Service should be marked Exported through the export table")
  }
  // The resident unexported sibling must retain a false flag.
  if internal.Exported {
    t.Fatalf("Internal is not exported but was marked Exported")
  }
}
