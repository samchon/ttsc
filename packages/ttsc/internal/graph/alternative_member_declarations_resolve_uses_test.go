package graph

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// Verifies equivalent member declarations produce usable endpoints.
//
// 1. Load type-literal intersections, nested properties, parameter properties and variable-bound class expressions.
// 2. Build their nodes and checker-resolved calls and accesses alongside interface and class-body controls.
// 3. Require precise members and reject unbound class identities and ordinary constructor parameters.
//
// @evidence contracts/testing.md#behavioral-verification Supported named literal members must have their own nodes, source spans and incoming uses. Class-expression bodies retain outgoing dependencies and internal constructor identity, while unindexed shadowing locals cannot borrow global endpoints.
// @evidence contracts/testing.md#independent-expectations The authored declaration hierarchy supplies literal names Props.onChange, Props.nested.deep, Props.extra, Sale.price and Widget.render, with source-authored caller/target pairs and separate negative controls.
// @evidence contracts/testing.md#distinguishing-cases Intersections, parenthesized/nested literals, quoted/computed-literal names, parameter-property modifiers, named class self-references, heritage and namespace owners contrast dynamic keys, normal parameters, unbound returned classes, shadowing local classes/objects and cross-owner calls. Existing tests own broader dispatch and object literals.
// @evidence contracts/testing.md#execution-ownership This Go unit writes a temporary project, owns and closes an in-process compiler Program and calls Build directly without a product process or installed consumer.
func TestAlternativeMemberDeclarationsResolveUses(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export function helper() { return 1; }
const key = Symbol("key");
export type Props = ({ onChange(): void; nested: { deep: number }; "quoted.key": number; [key]: number; ["computed"]: number }) & { extra: number };
export class Sale {
  constructor(public readonly price: number, ordinary: number, private secret = helper(), protected hidden = 1) {}
  read() { return this.secret + this.hidden; }
}
export class Base { render() { return 0; } }
export interface Drawable { render(): number }
export const Widget = (class Internal extends Base implements Drawable {
  render() { return helper(); }
  field = helper();
  static create() { return new Internal(); }
  static identity() { return Internal; }
});
export const Other = class { render() { return 2; } };
export const api = { run() { return helper(); } };
export function localClass() {
  const Widget = class Local { static create() { return new Local(); } };
  return Widget.create();
}
export function localObject() {
  const api = { run() { return 2; } };
  return api.run();
}
export function change(props: Props) { props.onChange(); return props.nested.deep + props.extra + props["quoted.key"] + props.computed; }
export function cost(sale: Sale) { return sale.price; }
export function draw() { return new Widget().render(); }
export function other() { return new Other().render(); }
export function anonymous() { return class { render() { return helper(); } }; }
export interface Control { run(): void }
export class Body { price = 1; }
export function control(input: Control, body: Body) { input.run(); return body.price; }
export namespace Names {
  export type Props = { nested: { deep: number } };
  export const Widget = class { render() { return helper(); } };
  export function read(props: Props) { new Widget().render(); return props.nested.deep; }
}
`)
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  defer func() { _ = prog.Close() }()
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %v", diags)
  }
  g := Build(prog)
  file := sourceFile(t, prog, "main.ts").FileName()
  for _, item := range []struct {
    caller, member string
    kind           NodeKind
    edge           EdgeKind
  }{
    {"change", "Props.onChange", NodeMethod, EdgeValueCall},
    {"change", "Props.nested.deep", NodeVariable, EdgeValueAccess},
    {"change", "Props.extra", NodeVariable, EdgeValueAccess},
    {"change", `Props["quoted.key"]`, NodeVariable, EdgeValueAccess},
    {"change", "Props.computed", NodeVariable, EdgeValueAccess},
    {"cost", "Sale.price", NodeVariable, EdgeValueAccess},
    {"draw", "Widget.render", NodeMethod, EdgeValueCall},
    {"other", "Other.render", NodeMethod, EdgeValueCall},
    {"control", "Control.run", NodeMethod, EdgeValueCall},
    {"control", "Body.price", NodeVariable, EdgeValueAccess},
    {"Names.read", "Names.Props.nested.deep", NodeVariable, EdgeValueAccess},
    {"Names.read", "Names.Widget.render", NodeMethod, EdgeValueCall},
  } {
    target := nodeID(file, item.member, item.kind)
    if node := g.Nodes[target]; node == nil || node.End <= node.Pos || node.Name != item.member {
      t.Errorf("missing member %s", item.member)
    }
    if !hasEdge(g, nodeID(file, item.caller, NodeFunction), target, item.edge) {
      t.Errorf("missing %s -> %s", item.caller, item.member)
    }
  }
  for member, kind := range map[string]NodeKind{"Widget.render": NodeMethod, "Widget.field": NodeVariable, "Sale.secret": NodeVariable} {
    if !hasEdge(g, nodeID(file, member, kind), nodeID(file, "helper", NodeFunction), EdgeValueCall) {
      t.Errorf("%s lost helper call", member)
    }
  }
  for _, target := range []struct {
    name string
    kind NodeKind
  }{{"Base", NodeClass}, {"Drawable", NodeInterface}} {
    if !hasEdge(g, nodeID(file, "Widget", NodeVariable), nodeID(file, target.name, target.kind), EdgeHeritage) {
      t.Errorf("Widget lost heritage to %s", target.name)
    }
    if !hasEdge(g, nodeID(file, "Widget.render", NodeMethod), nodeID(file, target.name+".render", NodeMethod), EdgeMemberRelation) {
      t.Errorf("Widget.render lost relation to %s.render", target.name)
    }
  }
  for _, item := range []struct {
    member string
    kind   EdgeKind
  }{{"Widget.create", EdgeValueCall}, {"Widget.identity", EdgeValueAccess}} {
    if !hasEdge(g, nodeID(file, item.member, NodeMethod), nodeID(file, "Widget", NodeVariable), item.kind) {
      t.Errorf("%s lost its bound class identity", item.member)
    }
  }
  if hasEdge(g, nodeID(file, "draw", NodeFunction), nodeID(file, "Other.render", NodeMethod), EdgeValueCall) ||
    hasEdge(g, nodeID(file, "other", NodeFunction), nodeID(file, "Widget.render", NodeMethod), EdgeValueCall) {
    t.Error("class-expression calls crossed their lexical owners")
  }
  for _, item := range []struct {
    caller, target string
    kind           NodeKind
  }{{"localClass", "Widget", NodeVariable}, {"localClass", "Widget.create", NodeMethod}, {"localObject", "api.run", NodeMethod}} {
    if hasEdge(g, nodeID(file, item.caller, NodeFunction), nodeID(file, item.target, item.kind), EdgeValueCall) {
      t.Errorf("%s borrowed unrelated top-level target %s", item.caller, item.target)
    }
  }
  allowed := map[string]bool{"Props.onChange": true, "Props.nested": true, "Props.nested.deep": true, "Props.extra": true, `Props["quoted.key"]`: true, "Props.computed": true}
  for _, node := range g.Nodes {
    if node.Name == "Sale.ordinary" || node.Name == "__class.render" || node.Name == "Internal.render" {
      t.Errorf("invented unowned identity %s", node.Name)
    }
    if (strings.HasPrefix(node.Name, "Props.") || strings.HasPrefix(node.Name, "Props[")) && !allowed[node.Name] {
      t.Errorf("invented type member %s", node.Name)
    }
  }
}
