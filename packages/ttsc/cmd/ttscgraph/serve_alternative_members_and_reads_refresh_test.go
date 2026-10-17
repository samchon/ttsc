package main

import (
  "path/filepath"
  "testing"
)

// Verifies reported graph facts survive resident edits and barrel imports.
//
// 1. Load namespace-private functions, a nested type member and a parameter property through a barrel.
// 2. Rename the nested member and replace a class expression in the same resident session.
// 3. Require current serialized nodes and uses, reject stale members and false namespace calls, and compare every generation with a full build.
//
// @evidence contracts/testing.md#behavioral-verification Resident shard publication must preserve lexical identities and actual value/member uses, then remove obsolete members after edits. Literal serialized endpoints test semantics independently of full-build equivalence.
// @evidence contracts/testing.md#independent-expectations Source-authored deep/changed and render/replaced names prescribe current and stale nodes. Only B.hidden calls target, reader accesses num, change accesses the current Props.nested member, cost accesses Sale.price and draw calls the current Widget member.
// @evidence contracts/testing.md#distinguishing-cases Initial and renamed generations cover cross-file barrel aliases, namespace-private declarations, value returns, nested type members, parameter properties and named/anonymous class expressions. Old member names and A.hidden-to-target provide negative controls; direct syntax cases belong to the graph package's source units.
// @evidence contracts/testing.md#execution-ownership This Go source unit owns one temporary project and in-process graphSession, closes it and invokes native preparation/projection directly without building or launching a product process.
func TestServeAlternativeMembersAndReadsRefresh(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true},"include":["src"]}`)
  writeGraphFile(t, filepath.Join(root, "src", "barrel.ts"), "export * from './api';\n")
  var session *graphSession
  for _, state := range []struct{ field, method, className string }{{"deep", "render", "Internal"}, {"changed", "replaced", ""}} {
    writeGraphFile(t, filepath.Join(root, "src", "api.ts"), `export const num = 1;
export function target() { return 0; }
export namespace A { function hidden() { return 1; } export const a = hidden(); }
export namespace B { function hidden() { return target(); } export const b = hidden(); }
export type Props = { nested: { `+state.field+`: number } };
export class Sale { constructor(public readonly price: number) {} }
export const Widget = class `+state.className+` { `+state.method+`() { return num; } };
`)
    writeGraphFile(t, filepath.Join(root, "src", "use.ts"), `import { num, Sale, Widget, type Props } from './barrel';
export function reader() { return num; }
export function change(props: Props) { return props.nested.`+state.field+`; }
export function cost(sale: Sale) { return sale.price; }
export function draw() { return new Widget().`+state.method+`(); }
`)
    if session == nil {
      var err error
      session, err = newGraphSession(root, "tsconfig.json")
      if err != nil {
        t.Fatal(err)
      }
      defer session.Close()
    }
    snapshot, _, _, err := snapshotGraphShardState(session)
    if err != nil || snapshot == nil {
      t.Fatalf("snapshot: %v", err)
    }
    assertServeShardFactsMatchFullDump(t, session)
    dump, err := projectGraphDump(session)
    if err != nil {
      t.Fatal(err)
    }
    ids := map[string]string{}
    for _, node := range dump.Nodes {
      name := node.QualifiedName
      if name == "" {
        name = node.Name
      }
      ids[name] = node.ID
      if (name == "Props.nested.deep" && state.field != "deep") || (name == "Widget.render" && state.method != "render") {
        t.Errorf("stale declaration %s", name)
      }
    }
    for _, pair := range []struct {
      from, to, kind string
      want           bool
    }{
      {"reader", "num", "accesses", true},
      {"change", "Props.nested." + state.field, "accesses", true},
      {"cost", "Sale.price", "accesses", true},
      {"draw", "Widget." + state.method, "calls", true},
      {"Widget." + state.method, "num", "accesses", true},
      {"A.a", "A.hidden", "calls", true},
      {"B.b", "B.hidden", "calls", true},
      {"B.hidden", "target", "calls", true},
      {"A.hidden", "target", "calls", false},
    } {
      if ids[pair.from] == "" || ids[pair.to] == "" {
        t.Errorf("missing endpoint %s or %s", pair.from, pair.to)
        continue
      }
      found := false
      for _, edge := range dump.Edges {
        if edge.From == ids[pair.from] && edge.To == ids[pair.to] && edge.Kind == pair.kind {
          found = true
        }
      }
      if found != pair.want {
        t.Errorf("%s -> %s (%s) = %t, want %t", pair.from, pair.to, pair.kind, found, pair.want)
      }
    }
  }
}
