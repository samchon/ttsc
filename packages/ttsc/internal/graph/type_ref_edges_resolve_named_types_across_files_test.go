package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestTypeRefEdgesResolveNamedTypesAcrossFiles verifies that a type-position
// reference to a named type in another file is recorded as a type-ref edge to
// that authored declaration, and is kept distinct from a value-call. This checks
// one parameter annotation; no downstream impact query or runtime use executes.
//
//  1. Compile a fixture where use(c: Config) annotates a parameter with an
//     interface declared in another file.
//  2. Build the graph.
//  3. Assert a use -> Config type-ref edge exists and is not a value-call.
//
// @evidence contracts/testing.md#behavioral-verification Requires the selected use-to-Config type-ref triple and rejects a value-call triple between the same endpoints. It does not assert exact edge counts, spans, all cross-file type forms, independent physical identity, or downstream impact-query behavior.
// @evidence contracts/testing.md#independent-expectations The expectation is literal: for use(c: Config) in main.ts with Config declared in types.ts, a type-ref edge must run from the use function to the Config interface node of types.ts and no value-call edge may run between the same two nodes.
// @evidence contracts/testing.md#distinguishing-cases Compile a fixture where use(c: Config) annotates a parameter with an interface declared in another file; Build the graph; Assert a use -> Config type-ref edge exists and is not a value-call.
// @evidence contracts/testing.md#execution-ownership Owns temporary native config and two source files and a directly loaded library Program, closes it, and restores an empty linked-plugin manifest. Build and both edge observations run in this process; selected endpoints share its actual filenames and the nodeID encoder. No product CLI, installation, emitted function evaluation, or downstream impact query runs.
func TestTypeRefEdgesResolveNamedTypesAcrossFiles(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
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
  use := nodeID(sourceFile(t, prog, "main.ts").FileName().AsString(), "use", NodeFunction)
  config := nodeID(sourceFile(t, prog, "types.ts").FileName().AsString(), "Config", NodeInterface)

  if !hasEdge(graph, use, config, EdgeTypeRef) {
    t.Fatalf("missing type-ref edge use -> Config; edges: %v", graph.Edges)
  }
  if hasEdge(graph, use, config, EdgeValueCall) {
    t.Fatalf("a type reference was misclassified as a value-call edge")
  }
}
