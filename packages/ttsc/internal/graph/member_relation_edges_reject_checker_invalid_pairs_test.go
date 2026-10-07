package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestMemberRelationEdgesRejectCheckerInvalidPairs verifies that an invalid
// member pair has no relation edge in the authored erroneous Program. Valid
// members in the same classes and an unrelated valid class retain their edges.
// No runtime dispatch follows these graph facts in this entry.
//
//  1. Compile invalid method/property, same-kind signature, and static/instance
//     implementations plus an invalid class override and one valid class.
//  2. Require the checker diagnostics that prove the fixture is rejected.
//  3. Assert invalid pairs have no member edges while the valid class still
//     carries its checker-backed implementation edges.
//
// @evidence contracts/testing.md#behavioral-verification Actual Program diagnostics must include TS2416 and TS2425; Build must retain six rejected pair endpoints without their member edges, three literal implements pairs and one overrides sibling. Exact relation multiplicity, each pair's own diagnostic and runtime dispatch are not asserted.
// @evidence contracts/testing.md#independent-expectations Literal authored member shapes define the six absent pairs and the four accepted origin expectations. Actual TS2416/TS2425 presence independently requires an erroneous fixture, but the codes are not correlated to each rejected pair. Resident endpoint checks distinguish relation rejection from dropped declarations; first matching origin checks do not prove uniqueness.
// @evidence contracts/testing.md#distinguishing-cases Compile invalid method/property, same-kind signature, and static/instance implementations plus an invalid class override and one valid class; Require the checker diagnostics that prove the fixture is rejected; Assert invalid pairs have no member edges while the valid class still carries its checker-backed implementation edges.
// @evidence contracts/testing.md#execution-ownership This Go source-unit writes a native project, constructs/closes its driver Program, queries actual diagnostics and directly calls Build in-process. Actual filename/shared ID formatting select literal pairs, using presence-only hasEdge and first-match edgeOrigin helpers. A restored empty linked-plugin manifest excludes ambient hooks; no emit, installed consumer or product process runs.
func TestMemberRelationEdgesRejectCheckerInvalidPairs(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
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
    if built.Nodes[pair.from] == nil || built.Nodes[pair.to] == nil {
      t.Fatalf("rejected pair endpoints missing %s -> %s; nodes: %v", pair.from, pair.to, nodeIDSet(built))
    }
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
