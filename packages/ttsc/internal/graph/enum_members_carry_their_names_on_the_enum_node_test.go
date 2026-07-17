package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEnumMembersCarryTheirNamesOnTheEnumNode verifies that an enum records the
// name and value of each member on its own node, and that nothing else does.
//
// The enum's node was always in the graph and had nothing in it (#738). Its
// signature stops at the `{`, its members are not nodes, so the outline a class
// gets is empty for an enum — and #732 gave it only values. The code writes
// `Colors.Red`, never `"red"`, so a caller that had already named the enum
// still opened the file for the one fact it came for.
//
// The names ride on the enum rather than on member nodes on purpose. A member
// node would be indexing what `grep -rn "Colors.Red"` answers exactly, and it
// would put leaves into tour flows to do it. Filling in a node the graph holds
// is indexing; minting nodes to carry detail is not.
//
//  1. Compile a fixture with a string enum, an implicitly numbered one, and a
//     class beside them.
//  2. Build the graph.
//  3. Assert each enum node carries its members name-and-value, that no member
//     became a node, and that a class node carries none of this.
func TestEnumMembersCarryTheirNamesOnTheEnumNode(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export enum Colors {
  Red = 'red',
  Green = 'green',
}

export enum Implicit {
  First,
  Second,
}

export class Cls {
  public value = 1;
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

  colors, ok := graph.Nodes[nodeID(path, "Colors", NodeEnum)]
  if !ok {
    t.Fatalf("missing enum node; nodes: %v", nodeIDSet(graph))
  }
  want := []EnumMember{{Name: "Red", Value: `"red"`}, {Name: "Green", Value: `"green"`}}
  if len(colors.EnumMembers) != len(want) {
    t.Fatalf("Colors reported %v, want %v", colors.EnumMembers, want)
  }
  for i, member := range want {
    if colors.EnumMembers[i] != member {
      t.Fatalf("Colors member %d is %v, want %v", i, colors.EnumMembers[i], member)
    }
  }

  // The values exist only in the checker here, so a scrape of the source could
  // not produce this pairing.
  implicit := graph.Nodes[nodeID(path, "Implicit", NodeEnum)]
  if implicit == nil ||
    len(implicit.EnumMembers) != 2 ||
    implicit.EnumMembers[0] != (EnumMember{Name: "First", Value: "0"}) ||
    implicit.EnumMembers[1] != (EnumMember{Name: "Second", Value: "1"}) {
    t.Fatalf("implicitly numbered enum did not pair its members: %v", implicit.EnumMembers)
  }

  // The line this fix holds: the members are facts on the enum, not nodes of
  // their own. A node per member would index what grep already answers.
  for id := range graph.Nodes {
    if id == nodeID(path, "Colors.Red", NodeVariable) ||
      id == nodeID(path, "Red", NodeVariable) {
      t.Fatalf("an enum member became a node (%s); it is a fact on the enum", id)
    }
  }

  // The negative twin: this rides on enums only. A class's fields are member
  // nodes and its outline comes from those.
  if cls := graph.Nodes[nodeID(path, "Cls", NodeClass)]; cls == nil ||
    len(cls.EnumMembers) != 0 {
    t.Fatalf("a class node carried enum members: %v", cls)
  }
}
