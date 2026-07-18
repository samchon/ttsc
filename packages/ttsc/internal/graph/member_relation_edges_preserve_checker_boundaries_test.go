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
//  3. Assert accepted pairs produce one member relation and rejected pairs none.
func TestMemberRelationEdgesPreserveCheckerBoundaries(t *testing.T) {
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
    if hasEdge(built, pair.from, pair.to, EdgeMemberRelation) {
      t.Fatalf("checker-rejected boundary gained a member edge %s -> %s; edges: %v", pair.from, pair.to, built.Edges)
    }
  }
}
