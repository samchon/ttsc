package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// Verifies private namespace declarations retain their lexical owners.
//
// 1. Load repeated private functions, classes, aliases and variables in two namespaces alongside top-level controls.
// 2. Build the graph and inspect declaration spans and resolved calls.
// 3. Require separate identities and reject calls borrowed from another scope.
//
// @evidence contracts/testing.md#behavioral-verification Build must retain each lexical declaration and connect only its actual callers and callees, exposing the false union of dependencies caused by a shared private name.
// @evidence contracts/testing.md#independent-expectations Literal A.hidden, B.hidden and hidden names follow the source's three distinct lexical scopes; only B.hidden calls target. Selected declarations must retain nonempty spans, without an independent byte-offset oracle.
// @evidence contracts/testing.md#distinguishing-cases Private functions, variables, classes, interfaces, aliases, nested namespaces and named closures contrast exported members and a top-level function of the same name. Moving source offsets is covered by the existing position-invariance tests.
// @evidence contracts/testing.md#execution-ownership This Go unit owns a temporary project and in-process compiler Program, closes it and calls Build directly without installing or launching a product host.
func TestNamespacePrivateDeclarationsKeepLexicalIdentity(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export function target() { return 0; }
export namespace A {
  function hidden() { return 1; }
  class Local { method() { return hidden(); } }
  interface Shape { value: number }
  type Alias = Shape;
  const local = hidden();
  export const a = hidden();
  export namespace Deep { function hidden() { return 4; } export const d = hidden(); }
  export function factory() { function hidden() { return 5; } return hidden(); }
}
export namespace B {
  function hidden() { return target(); }
  class Local { method() { return hidden(); } }
  interface Shape { value: number }
  type Alias = Shape;
  const local = hidden();
  export const b = hidden();
}
function hidden() { return 3; }
export const c = hidden();
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
  for _, prefix := range []string{"A", "B"} {
    for name, kind := range map[string]NodeKind{
      "hidden": NodeFunction, "Local": NodeClass, "Local.method": NodeMethod,
      "Shape": NodeInterface, "Shape.value": NodeVariable, "Alias": NodeTypeAlias, "local": NodeVariable,
    } {
      if node := g.Nodes[nodeID(string(file), prefix+"."+name, kind)]; node == nil || node.Name != prefix+"."+name || node.End <= node.Pos {
        t.Errorf("missing lexical declaration %s.%s", prefix, name)
      }
    }
  }
  for _, name := range []string{"A.hidden", "B.hidden", "hidden", "A.Deep.hidden", "A.factory.hidden"} {
    id := nodeID(string(file), name, NodeFunction)
    if g.Nodes[id] == nil {
      t.Errorf("missing %s", name)
    }
    if got := hasEdge(g, id, nodeID(string(file), "target", NodeFunction), EdgeValueCall); got != (name == "B.hidden") {
      t.Errorf("%s calls target = %t, want %t", name, got, name == "B.hidden")
    }
  }
  for caller, target := range map[string]string{"A.a": "A.hidden", "B.b": "B.hidden", "c": "hidden", "A.Deep.d": "A.Deep.hidden"} {
    for _, candidate := range []string{"A.hidden", "B.hidden", "hidden", "A.Deep.hidden", "A.factory.hidden"} {
      if got := hasEdge(g, nodeID(string(file), caller, NodeVariable), nodeID(string(file), candidate, NodeFunction), EdgeValueCall); got != (candidate == target) {
        t.Errorf("%s -> %s = %t, want %t", caller, candidate, got, candidate == target)
      }
    }
  }
  if !hasEdge(g, nodeID(string(file), "A.factory", NodeFunction), nodeID(string(file), "A.factory.hidden", NodeFunction), EdgeValueCall) {
    t.Error("factory lost its own hidden closure")
  }
}
