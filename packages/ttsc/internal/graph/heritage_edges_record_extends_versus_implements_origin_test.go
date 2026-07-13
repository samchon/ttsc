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
// One class declaration carries both clauses at once, so the test pins that the
// keyword — not the base's declaration kind — selects the origin: `extends Sup`
// and `implements Iface` on the same class must come out as different origins.
//
//  1. Compile `class Sub extends Sup implements Iface` plus the base class and
//     interface.
//  2. Build the graph.
//  3. Assert the Sub->Sup heritage edge has Origin "extends" and the Sub->Iface
//     heritage edge has Origin "implements".
func TestHeritageEdgesRecordExtendsVersusImplementsOrigin(t *testing.T) {
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

  sub := nodeID(path, "Sub", NodeClass)
  sup := nodeID(path, "Sup", NodeClass)
  iface := nodeID(path, "Iface", NodeInterface)

  if got := edgeOrigin(graph, sub, sup, EdgeHeritage); got != "extends" {
    t.Fatalf("Sub -> Sup: want heritage Origin \"extends\", got %q; edges: %v", got, graph.Edges)
  }
  if got := edgeOrigin(graph, sub, iface, EdgeHeritage); got != "implements" {
    t.Fatalf("Sub -> Iface: want heritage Origin \"implements\", got %q; edges: %v", got, graph.Edges)
  }
}
