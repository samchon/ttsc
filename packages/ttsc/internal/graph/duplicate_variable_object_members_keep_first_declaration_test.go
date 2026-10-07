package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDuplicateVariableObjectMembersKeepFirstDeclaration checks the first
// object's member survives two authored var declarations of one name, both
// in the built graph and in the dump. Declaration spans and complete semantic
// diagnostic legality are not asserted by this entry.
//
//  1. Compile two var declarations with the same symbol and different objects.
//  2. Assert the graph keeps exactly the first object's direct member.
//  3. Dump the graph and assert the same member remains on the wire.
//
// @evidence contracts/testing.md#behavioral-verification Build must retain exactly the member first on the repeated variable node; NewDump must retain that one member with literal signature first: 1 rather than second. Node declaration spans and full Program semantic diagnostics are not checked.
// @evidence contracts/testing.md#independent-expectations The expectations are literal over two var declarations of one symbol ({ first: 1 } then { second: 2 }): the built node must carry exactly one object member named first, and the dump node src/main.ts#duplicate:variable must carry exactly that member with signature first: 1.
// @evidence contracts/testing.md#distinguishing-cases Two same-name declarations with different member literals distinguish preservation of the first member from overwrite or member union. Both in-memory member identity and dumped signature are asserted; single-declaration and other initializer forms are not owned here.
// @evidence contracts/testing.md#execution-ownership This Go source-unit writes a native project and loads/closes its compiler Program in-process, invoking Build, NewDump and SourceTexts directly. A restored empty linked-plugin manifest excludes ambient hooks. Node selection uses the actual Program filename and shared ID formatter, not an independent ID-grammar oracle; no consumer installation or product process runs.
func TestDuplicateVariableObjectMembersKeepFirstDeclaration(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export var duplicate = { first: 1 };
export var duplicate = { second: 2 };
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
  node := graph.Nodes[nodeID(path, "duplicate", NodeVariable)]
  if node == nil {
    t.Fatalf("missing duplicate variable; nodes: %v", nodeIDSet(graph))
  }
  if len(node.ObjectMembers) != 1 || node.ObjectMembers[0].Name != "first" {
    t.Fatalf("first declaration members were overwritten: %+v", node.ObjectMembers)
  }

  dump, err := NewDump(graph, root, "tsconfig.json", nil, SourceTexts(prog), DumpOrigin{})
  if err != nil {
    t.Fatal(err)
  }
  for _, dumped := range dump.Nodes {
    if dumped.ID != "src/main.ts#duplicate:variable" {
      continue
    }
    if len(dumped.ObjectMembers) != 1 || dumped.ObjectMembers[0].Name != "first" || dumped.ObjectMembers[0].Signature != "first: 1" {
      t.Fatalf("dump mixed declarations: %+v", dumped.ObjectMembers)
    }
    return
  }
  t.Fatalf("dump omitted duplicate variable: %+v", dump.Nodes)
}
