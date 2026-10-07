package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestMemberRelationEdgesFollowCheckerValidity verifies that native graph
// member relationships preserve the structurally valid shapes the TypeScript
// checker accepts, including shapes whose syntax kinds differ.
//
// A method/property equality gate would drop two valid implementations here: a
// getter satisfying a readonly property and a method satisfying a
// function-valued property. The graph must follow checker assignability rather
// than replace one name heuristic with a kind heuristic.
//
//  1. Compile a class implementing an interface through ordinary methods plus
//     the two valid cross-kind shapes, and a class overriding an abstract base.
//  2. Build the native graph.
//  3. Assert the five selected member pairs have the correct relation, while
//     the two resident constructor nodes have no tested override edge.
//
// @evidence contracts/testing.md#behavioral-verification The fixture must have zero actual Program diagnostics, and Build must report five literal implements/overrides pairs, including two cross-kind implementations. Both constructor nodes must exist without a member-relation edge between them. Other valid shapes, exact relation counts and spans are not asserted.
// @evidence contracts/testing.md#independent-expectations The oracle is the TypeScript checker: the fixture is first required to have no diagnostics, then the literal pairs Implementation.run/name/callback to Contract.run/name/callback must carry origin implements (including the getter-for-readonly-property and method-for-function-property shapes) and Derived.act/property to Base.act/property must carry origin overrides, while Derived's constructor must have no member-relation edge to Base's.
// @evidence contracts/testing.md#distinguishing-cases Ordinary methods and property overrides contrast the selected getter-for-property and method-for-function-property accepted shapes. Resident constructor nodes supply a bounded negative relation counterpart; invalid pairs are not exercised by this valid fixture.
// @evidence contracts/testing.md#execution-ownership This Go source-unit writes a native project, constructs/closes its driver Program, queries actual diagnostics and directly calls Build in-process. Actual filename/shared ID formatting select literal pairs; edgeOrigin reads a first matching edge rather than proving uniqueness. A restored empty linked-plugin manifest excludes ambient hooks; no emit, installed consumer or product process runs.
func TestMemberRelationEdgesFollowCheckerValidity(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export interface Contract {
  run(input: string): string;
  readonly name: string;
  callback: () => void;
}
export class Implementation implements Contract {
  run(input: string): string { return input; }
  get name(): string { return "implementation"; }
  callback(): void {}
}
export abstract class Base {
  constructor(readonly seed: string) {}
  abstract act(input: string): string;
  property: () => void = () => {};
}
export class Derived extends Base {
  constructor() { super("seed"); }
  act(input: string): string { return input; }
  property: () => void = () => {};
}
`)

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected load diagnostics: %v", diags)
  }
  defer func() { _ = prog.Close() }()
  if diagnostics := prog.Diagnostics(); len(diagnostics) != 0 {
    t.Fatalf("fixture must be checker-valid: %v", diagnostics)
  }

  built := Build(prog)
  path := sourceFile(t, prog, "main.ts").FileName()
  assertions := []struct {
    from   string
    to     string
    origin string
  }{
    {nodeID(path, "Implementation.run", NodeMethod), nodeID(path, "Contract.run", NodeMethod), "implements"},
    {nodeID(path, "Implementation.name", NodeMethod), nodeID(path, "Contract.name", NodeVariable), "implements"},
    {nodeID(path, "Implementation.callback", NodeMethod), nodeID(path, "Contract.callback", NodeVariable), "implements"},
    {nodeID(path, "Derived.act", NodeMethod), nodeID(path, "Base.act", NodeMethod), "overrides"},
    {nodeID(path, "Derived.property", NodeVariable), nodeID(path, "Base.property", NodeVariable), "overrides"},
  }
  for _, assertion := range assertions {
    if got := edgeOrigin(built, assertion.from, assertion.to, EdgeMemberRelation); got != assertion.origin {
      t.Fatalf("%s -> %s: want %q member relation, got %q; edges: %v", assertion.from, assertion.to, assertion.origin, got, built.Edges)
    }
  }

  derivedConstructor := nodeID(path, "Derived.__constructor", NodeMethod)
  baseConstructor := nodeID(path, "Base.__constructor", NodeMethod)
  if built.Nodes[derivedConstructor] == nil || built.Nodes[baseConstructor] == nil {
    t.Fatalf("missing fixture constructor nodes; nodes: %v", nodeIDSet(built))
  }
  if hasEdge(built, derivedConstructor, baseConstructor, EdgeMemberRelation) {
    t.Fatalf("constructors are not member overrides; edges: %v", built.Edges)
  }
}
