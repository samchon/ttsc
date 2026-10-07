package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestMemberRelationEdgesPreserveCheckerBoundaries verifies the pair query
// retains instantiated, overloaded, optional, declaration-merged, mixed-symbol,
// and class-override semantics.
//
// These boundaries are exactly where comparing member names, syntax kinds, or
// already-extracted property types diverges from the TypeScript checker. The
// fixture intentionally contains diagnostics; every pair is judged locally so
// valid siblings and unrelated valid declarations still produce edges.
//
//  1. Build generic, overloaded, optional, merged, property/method, and
//     accessor cases.
//  2. Require checker diagnostics for the deliberately rejected declarations.
//  3. Assert accepted pairs have their expected relation origin and rejected
//     pairs have resident endpoint nodes but no member relation.
//
// @evidence contracts/testing.md#behavioral-verification Build's eleven authored accepted pairs must have their literal first-matching relation origin, while six rejected pairs must have resident endpoints and no member-relation edge. One erroneous Program also contains accepted siblings; all generic/override rules or exact edge multiplicities are not certified.
// @evidence contracts/testing.md#independent-expectations The oracle is the TypeScript checker's accept/reject decisions encoded in the fixture: eleven accepted pairs (generic instantiation, overload set, optional-to-required, property for method, abstract accessor, split and merged declarations, protected override) must carry the literal origin implements or overrides, and six rejected pairs (wrong generic method, optional for required, method for property, property over concrete accessor, mixed-flag symbol, protected pretender) must have no member-relation edge. The only diagnostic requirement is that the program has at least one diagnostic, so the rejection of each specific pair is shown by the absent edge, not by a named diagnostic.
// @evidence contracts/testing.md#distinguishing-cases Accepted pairs and rejected pairs sit side by side in one erroneous program, so a rejected sibling must not suppress an accepted one and an accepted one must not admit a rejected one; each pair's edge presence or absence is asserted by node id, and presence is checked by origin equality rather than by a count of exactly one.
// @evidence contracts/testing.md#execution-ownership This Go source-unit writes a native project, constructs/closes its driver Program, requires at least one actual diagnostic and directly calls Build in-process. Actual filename/shared ID formatting select literal pairs, with first-match edgeOrigin and presence-only hasEdge helpers. A restored empty linked-plugin manifest excludes ambient hooks; no emit, installed consumer or product process runs.
func TestMemberRelationEdgesPreserveCheckerBoundaries(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export interface Generic<T> {
  map(input: T): T;
  required: T;
}
export class StringGeneric implements Generic<string> {
  map(input: string): string { return input; }
  required = "valid";
}
export class WrongGeneric implements Generic<string> {
  map(input: number): number { return input; }
  required = "valid sibling";
}

export interface Parser {
  parse(input: string): string;
  parse(input: number): number;
}
export class ParserImpl implements Parser {
  parse(input: string): string;
  parse(input: number): number;
  parse(input: string | number): string | number { return input; }
}

export interface OptionalContract {
  value?: string;
}
export class RequiredGood implements OptionalContract {
  value = "valid";
}
export interface RequiredContract {
  value: string;
}
export class OptionalWrong implements RequiredContract {
  value?: string;
}

export class MethodBase {
  run(): void {}
}
export class PropertyDerived extends MethodBase {
  run = (): void => {};
}
export class PropertyBase {
  run: () => void = () => {};
}
export class MethodWrong extends PropertyBase {
  run(): void {}
}

export abstract class AbstractAccessorBase {
  abstract get label(): string;
}
export class AbstractPropertyDerived extends AbstractAccessorBase {
  label = "valid";
}
export class ConcreteAccessorBase {
  get label(): string { return "base"; }
}
export class ConcretePropertyWrong extends ConcreteAccessorBase {
  label = "invalid";
}

export class MixedFlagBase {
  item = "base";
}
export class MixedFlagDerived extends MixedFlagBase {
  get item(): string { return "invalid"; }
}
export interface MixedFlagDerived {
  item: string;
}

export interface SplitBase {
  alpha(): string;
}
export interface SplitBase {
  beta(): string;
}
export interface SplitDerived extends SplitBase {
  alpha(): string;
}
export interface SplitDerived {
  beta(): string;
}

export class MergedBase {}
export interface MergedBase {
  augment(): void;
}
export class MergedDerived extends MergedBase {
  augment(): void {}
}

export class ProtectedBase {
  protected token = "base";
}
export class ProtectedGood extends ProtectedBase {
  protected token = "valid";
}
export class ProtectedPretender implements ProtectedBase {
  protected token = "invalid";
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
  if diagnostics := prog.Diagnostics(); len(diagnostics) == 0 {
    t.Fatal("fixture must contain checker-rejected boundary cases")
  }

  built := Build(prog)
  path := sourceFile(t, prog, "main.ts").FileName()
  for _, id := range []string{
    nodeID(path, "MixedFlagDerived.item", NodeMethod),
    nodeID(path, "MixedFlagBase.item", NodeVariable),
  } {
    if _, ok := built.Nodes[id]; !ok {
      t.Fatalf("mixed-symbol boundary node %s is missing; nodes: %v", id, built.Nodes)
    }
  }
  expected := []struct {
    from   string
    to     string
    origin string
  }{
    {nodeID(path, "StringGeneric.map", NodeMethod), nodeID(path, "Generic.map", NodeMethod), "implements"},
    {nodeID(path, "StringGeneric.required", NodeVariable), nodeID(path, "Generic.required", NodeVariable), "implements"},
    {nodeID(path, "WrongGeneric.required", NodeVariable), nodeID(path, "Generic.required", NodeVariable), "implements"},
    {nodeID(path, "ParserImpl.parse", NodeMethod), nodeID(path, "Parser.parse", NodeMethod), "implements"},
    {nodeID(path, "RequiredGood.value", NodeVariable), nodeID(path, "OptionalContract.value", NodeVariable), "implements"},
    {nodeID(path, "PropertyDerived.run", NodeVariable), nodeID(path, "MethodBase.run", NodeMethod), "overrides"},
    {nodeID(path, "AbstractPropertyDerived.label", NodeVariable), nodeID(path, "AbstractAccessorBase.label", NodeMethod), "overrides"},
    {nodeID(path, "SplitDerived.alpha", NodeMethod), nodeID(path, "SplitBase.alpha", NodeMethod), "overrides"},
    {nodeID(path, "SplitDerived.beta", NodeMethod), nodeID(path, "SplitBase.beta", NodeMethod), "overrides"},
    {nodeID(path, "MergedDerived.augment", NodeMethod), nodeID(path, "MergedBase.augment", NodeMethod), "overrides"},
    {nodeID(path, "ProtectedGood.token", NodeVariable), nodeID(path, "ProtectedBase.token", NodeVariable), "overrides"},
  }
  for _, pair := range expected {
    if got := edgeOrigin(built, pair.from, pair.to, EdgeMemberRelation); got != pair.origin {
      t.Fatalf("%s -> %s: want %q, got %q; edges: %v", pair.from, pair.to, pair.origin, got, built.Edges)
    }
  }

  rejected := []struct {
    from string
    to   string
  }{
    {nodeID(path, "WrongGeneric.map", NodeMethod), nodeID(path, "Generic.map", NodeMethod)},
    {nodeID(path, "OptionalWrong.value", NodeVariable), nodeID(path, "RequiredContract.value", NodeVariable)},
    {nodeID(path, "MethodWrong.run", NodeMethod), nodeID(path, "PropertyBase.run", NodeVariable)},
    {nodeID(path, "ConcretePropertyWrong.label", NodeVariable), nodeID(path, "ConcreteAccessorBase.label", NodeMethod)},
    {nodeID(path, "MixedFlagDerived.item", NodeMethod), nodeID(path, "MixedFlagBase.item", NodeVariable)},
    {nodeID(path, "ProtectedPretender.token", NodeVariable), nodeID(path, "ProtectedBase.token", NodeVariable)},
  }
  for _, pair := range rejected {
    if built.Nodes[pair.from] == nil || built.Nodes[pair.to] == nil {
      t.Fatalf("rejected pair endpoints missing %s -> %s; nodes: %v", pair.from, pair.to, nodeIDSet(built))
    }
    if hasEdge(built, pair.from, pair.to, EdgeMemberRelation) {
      t.Fatalf("checker-rejected boundary gained a member edge %s -> %s; edges: %v", pair.from, pair.to, built.Edges)
    }
  }
}
