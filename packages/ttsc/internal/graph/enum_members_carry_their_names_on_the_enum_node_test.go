package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEnumMembersCarryTheirNamesOnTheEnumNode verifies that an enum records the
// selected member pairs on enum nodes. Three authored enums cover string,
// implicit numeric and duplicate-value declarations, with one class negative.
// The member-node absence check is limited to two candidate IDs for Colors.Red.
//
//  1. Load a fixture with string, implicitly numbered and duplicate-value enums
//     plus a class.
//  2. Build the graph.
//  3. Assert selected pairs, duplicate names and literal count, two absent Red
//     variable IDs, and empty enum members on the class.
//
// @evidence contracts/testing.md#behavioral-verification Build must retain ordered Colors string pairs and Implicit numeric pairs, all three Dup names with a two-entry literal array, no variable node at either tested Colors.Red/Red ID, and no enum members on Cls. Dup literal contents and absence of every possible member-node ID are not asserted.
// @evidence contracts/testing.md#independent-expectations Literal fixture expectations are Red/"red", Green/"green", First/0, Second/1 in order; Dup names A/B/C and Literals length two; absence of the two Colors.Red/Red variable IDs; and empty Cls.EnumMembers. Shared ID formatting is a selection dependency, while member names, values and counts are independent literals.
// @evidence contracts/testing.md#distinguishing-cases Ordered string and implicit numeric pairs contrast explicit and inferred values; duplicate-value names must not collapse, while their literal array has two entries. Two Red variable IDs and Cls.EnumMembers provide bounded negative counterparts; other member forms are not tested here.
// @evidence contracts/testing.md#execution-ownership This Go source-unit writes a native project, constructs/closes a driver Program in-process and directly calls Build. A local helper copies reported member names for literal comparisons; a restored empty linked-plugin manifest excludes ambient hooks. No emit, consumer installation or product process runs.
func TestEnumMembersCarryTheirNamesOnTheEnumNode(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
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

// Two members, one value: a type folds these together, a declaration does not.
export enum Dup {
  A = 'x',
  B = 'x',
  C = 'y',
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

  colors, ok := graph.Nodes[nodeID(path.AsString(), "Colors", NodeEnum)]
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

  // The expected numeric values are not written as initializers in the fixture.
  // This result check does not prove which acquisition method produced them.
  implicit := graph.Nodes[nodeID(path.AsString(), "Implicit", NodeEnum)]
  if implicit == nil ||
    len(implicit.EnumMembers) != 2 ||
    implicit.EnumMembers[0] != (EnumMember{Name: "First", Value: "0"}) ||
    implicit.EnumMembers[1] != (EnumMember{Name: "Second", Value: "1"}) {
    t.Fatalf("implicitly numbered enum did not pair its members: %v", implicit.EnumMembers)
  }

  // Three declared names must remain even when A and B share one value.
  dup := graph.Nodes[nodeID(path.AsString(), "Dup", NodeEnum)]
  if dup == nil {
    t.Fatalf("missing Dup; nodes: %v", nodeIDSet(graph))
  }
  if names := memberNames(dup.EnumMembers); len(names) != 3 ||
    names[0] != "A" || names[1] != "B" || names[2] != "C" {
    t.Fatalf("a member sharing another's value was dropped: %v", names)
  }
  // The reported literal array must have two entries; their contents are not
  // asserted by this count check.
  if len(dup.Literals) != 2 {
    t.Fatalf("the value set should hold each distinct value once: %v", dup.Literals)
  }

  // Reject the two candidate variable-node IDs for the authored Red member.
  for id := range graph.Nodes {
    if id == nodeID(path.AsString(), "Colors.Red", NodeVariable) ||
      id == nodeID(path.AsString(), "Red", NodeVariable) {
      t.Fatalf("an enum member became a node (%s); it is a fact on the enum", id)
    }
  }

  // The negative twin: this rides on enums only. A class's fields are member
  // nodes and its outline comes from those.
  if cls := graph.Nodes[nodeID(path.AsString(), "Cls", NodeClass)]; cls == nil ||
    len(cls.EnumMembers) != 0 {
    t.Fatalf("a class node carried enum members: %v", cls)
  }
}

func memberNames(members []EnumMember) []string {
  out := make([]string, 0, len(members))
  for _, member := range members {
    out = append(out, member.Name)
  }
  return out
}
