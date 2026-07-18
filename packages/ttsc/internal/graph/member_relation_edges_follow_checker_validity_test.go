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
//  3. Assert every directly declared checker-valid pair has the correct member
//     relation while constructors never become override edges.
func TestMemberRelationEdgesFollowCheckerValidity(t *testing.T) {
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
  if hasEdge(built, derivedConstructor, baseConstructor, EdgeMemberRelation) {
    t.Fatalf("constructors are not member overrides; edges: %v", built.Edges)
  }
}
