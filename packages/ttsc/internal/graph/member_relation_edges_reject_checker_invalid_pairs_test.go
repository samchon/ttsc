package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestMemberRelationEdgesRejectCheckerInvalidPairs verifies that an invalid
// heritage relation cannot still manufacture authoritative member edges.
//
// The former TypeScript-memory synthesis compared only names and the broad
// method/property set, so TS2416 and TS2425 diagnostics coexisted with
// `implements`/`overrides` edges and those edges could become runtime dispatch
// hops. A valid class in the same erroneous Program is the negative twin: an
// unrelated diagnostic must not globally disable checker-owned relations.
//
//  1. Compile invalid method/property, same-kind signature, and static/instance
//     implementations plus an invalid class override and one valid class.
//  2. Require the checker diagnostics that prove the fixture is rejected.
//  3. Assert invalid pairs have no member edges while the valid class still
//     carries its checker-backed implementation edges.
func TestMemberRelationEdgesRejectCheckerInvalidPairs(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export interface Contract {
  kept: string;
  value: string;
  run(input: string): string;
}
export class WrongKind implements Contract {
  kept = "checker-valid sibling";
  value(): void {}
  run(input: number): number { return input; }
}
export class StaticOnly implements Contract {
  static kept = "static";
  static value = "static";
  static run(input: string): string { return input; }
}
export class Valid implements Contract {
  kept = "valid";
  value = "valid";
  run(input: string): string { return input; }
}
export class Base {
  kept = "base";
  value = "base";
  run(input: string): string { return input; }
}
export class InvalidDerived extends Base {
  kept = "checker-valid sibling";
  value(): void {}
  run(input: number): number { return input; }
}
`)

  prog, loadDiags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(loadDiags) != 0 {
    t.Fatalf("unexpected load diagnostics: %v", loadDiags)
  }
  defer func() { _ = prog.Close() }()

  diagnostics := prog.Diagnostics()
  seen2416 := false
  seen2425 := false
  for _, diagnostic := range diagnostics {
    seen2416 = seen2416 || diagnostic.Code == 2416
    seen2425 = seen2425 || diagnostic.Code == 2425
  }
  if !seen2416 || !seen2425 {
    t.Fatalf("fixture must prove incompatible member diagnostics TS2416 and TS2425; got %v", diagnostics)
  }

  built := Build(prog)
  path := sourceFile(t, prog, "main.ts").FileName()
  absent := []struct {
    from string
    to   string
  }{
    {nodeID(path, "WrongKind.value", NodeMethod), nodeID(path, "Contract.value", NodeVariable)},
    {nodeID(path, "WrongKind.run", NodeMethod), nodeID(path, "Contract.run", NodeMethod)},
    {nodeID(path, "StaticOnly.value", NodeVariable), nodeID(path, "Contract.value", NodeVariable)},
    {nodeID(path, "StaticOnly.run", NodeMethod), nodeID(path, "Contract.run", NodeMethod)},
    {nodeID(path, "InvalidDerived.value", NodeMethod), nodeID(path, "Base.value", NodeVariable)},
    {nodeID(path, "InvalidDerived.run", NodeMethod), nodeID(path, "Base.run", NodeMethod)},
  }
  for _, pair := range absent {
    if hasEdge(built, pair.from, pair.to, EdgeMemberRelation) {
      t.Fatalf("checker-invalid pair gained an authoritative member edge %s -> %s; edges: %v", pair.from, pair.to, built.Edges)
    }
  }

  valid := []struct {
    from string
    to   string
  }{
    {nodeID(path, "WrongKind.kept", NodeVariable), nodeID(path, "Contract.kept", NodeVariable)},
    {nodeID(path, "Valid.value", NodeVariable), nodeID(path, "Contract.value", NodeVariable)},
    {nodeID(path, "Valid.run", NodeMethod), nodeID(path, "Contract.run", NodeMethod)},
  }
  for _, pair := range valid {
    if got := edgeOrigin(built, pair.from, pair.to, EdgeMemberRelation); got != "implements" {
      t.Fatalf("valid implementation pair %s -> %s lost its checker-owned edge: got %q; edges: %v", pair.from, pair.to, got, built.Edges)
    }
  }
  if got := edgeOrigin(
    built,
    nodeID(path, "InvalidDerived.kept", NodeVariable),
    nodeID(path, "Base.kept", NodeVariable),
    EdgeMemberRelation,
  ); got != "overrides" {
    t.Fatalf("valid override sibling in an invalid class was suppressed: got %q; edges: %v", got, built.Edges)
  }
}
