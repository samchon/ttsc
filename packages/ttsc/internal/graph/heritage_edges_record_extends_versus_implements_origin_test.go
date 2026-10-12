package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestHeritageEdgesRecordExtendsVersusImplementsOrigin verifies that a heritage
// edge carries the clause keyword as Origin, so the dump can split the single
// internal heritage kind into the schema's `extends` and `implements`: a class
// superclass records "extends", a class interface list records "implements".
//
// One class declaration carries both clauses at once: extends Sup and implements
// Iface must have their literal origins. Their target kinds differ too, so this
// entry alone cannot distinguish keyword selection from a target-kind heuristic.
//
//  1. Compile `class Sub extends Sup implements Iface` plus the base class and
//     interface.
//  2. Build the graph.
//  3. Assert the Sub->Sup heritage edge has Origin "extends" and the Sub->Iface
//     heritage edge has Origin "implements".
//
// @evidence contracts/testing.md#behavioral-verification Verifies that a heritage edge carries the clause keyword as Origin, so the dump can split the single internal heritage kind into the schema's `extends` and `implements`: a class superclass records "extends", a class interface list records "implements".
// @evidence contracts/testing.md#independent-expectations Literal extends and implements origins follow the authored clauses for Sub-to-Sup and Sub-to-Iface. Sup is a class and Iface an interface, so this input alone cannot reject a target-kind heuristic; TestHeritageEdgesKeepExtendsAndImplementsToSameBase supplies the same-target counterpart.
// @evidence contracts/testing.md#distinguishing-cases Compile `class Sub extends Sup implements Iface` plus the base class and interface; Build the graph; Assert the Sub->Sup heritage edge has Origin "extends" and the Sub->Iface heritage edge has Origin "implements".
// @evidence contracts/testing.md#execution-ownership This Go source-unit writes a native project, constructs/closes its driver Program in-process and directly calls Build. The local edgeOrigin helper reads the first matching triple; actual Program filename/shared ID formatting select literal endpoints, not an independent ID grammar. A restored empty linked-plugin manifest excludes ambient hooks; no dump serialization, installed consumer or product process runs.
func TestHeritageEdgesRecordExtendsVersusImplementsOrigin(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export interface Iface {}
export class Sup {}
export class Sub extends Sup implements Iface {}
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

  sub := nodeID(path.AsString(), "Sub", NodeClass)
  sup := nodeID(path.AsString(), "Sup", NodeClass)
  iface := nodeID(path.AsString(), "Iface", NodeInterface)

  if got := edgeOrigin(graph, sub, sup, EdgeHeritage); got != "extends" {
    t.Fatalf("Sub -> Sup: want heritage Origin \"extends\", got %q; edges: %v", got, graph.Edges)
  }
  if got := edgeOrigin(graph, sub, iface, EdgeHeritage); got != "implements" {
    t.Fatalf("Sub -> Iface: want heritage Origin \"implements\", got %q; edges: %v", got, graph.Edges)
  }
}
