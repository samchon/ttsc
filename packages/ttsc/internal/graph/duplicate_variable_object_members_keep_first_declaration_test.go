package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDuplicateVariableObjectMembersKeepFirstDeclaration verifies that a legal
// repeated var declaration cannot attach its initializer to the first node.
//
// Variable symbols merge across declarations, while graph node identity keeps
// the first declaration. Collecting object members after every add used to
// combine the first declaration's span with the second declaration's members,
// producing a node that never existed in the compiler snapshot.
//
//  1. Compile two var declarations with the same symbol and different objects.
//  2. Assert the graph keeps the first declaration and its direct member.
//  3. Dump the graph and assert the same member remains on the wire.
func TestDuplicateVariableObjectMembersKeepFirstDeclaration(t *testing.T) {
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
