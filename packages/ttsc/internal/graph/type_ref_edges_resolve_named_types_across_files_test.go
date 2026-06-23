package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestTypeRefEdgesResolveNamedTypesAcrossFiles verifies that a type-position
// reference to a named type in another file is recorded as a type-ref edge to
// that type's real declaration, and is kept distinct from a value-call. Treating
// type references as first-class edges lets an impact query separate "uses this
// at runtime" from "depends on this type", which fits the ttsc thesis.
//
//  1. Compile a fixture where use(c: Config) annotates a parameter with an
//     interface declared in another file.
//  2. Build the graph.
//  3. Assert a use -> Config type-ref edge exists and is not a value-call.
func TestTypeRefEdgesResolveNamedTypesAcrossFiles(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "types.ts"), `export interface Config {
  name: string;
}
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `import { Config } from "./types";
export function use(c: Config): string {
  return c.name;
}
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
  use := nodeID(sourceFile(t, prog, "main.ts").FileName(), "use", NodeFunction)
  config := nodeID(sourceFile(t, prog, "types.ts").FileName(), "Config", NodeInterface)

  if !hasEdge(graph, use, config, EdgeTypeRef) {
    t.Fatalf("missing type-ref edge use -> Config; edges: %v", graph.Edges)
  }
  if hasEdge(graph, use, config, EdgeValueCall) {
    t.Fatalf("a type reference was misclassified as a value-call edge")
  }
}
