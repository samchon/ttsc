package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestNamespaceDottedFormQualifiesDeeply covers the chained-module shape that a
// single-level namespace test does not: `namespace A.B.C { … }` is parsed as a
// ModuleDeclaration whose body is another ModuleDeclaration, so moduleStatements
// must descend through the chain and qualifiedName must build the full dotted
// prefix. This entry asserts one authored three-level dotted function ID and
// incoming call, not every nested namespace form or declaration payload.
//
// 1. Load dotted namespace A.B.C with deep and a caller.
// 2. Build qualified namespace declarations and calls.
// 3. Require A.B.C.deep and the caller value-call edge to that qualified declaration.
//
// @evidence contracts/testing.md#behavioral-verification Require A.B.C.deep and the caller value-call edge to that qualified declaration.
// @evidence contracts/testing.md#independent-expectations Literal A.B.C.deep and caller names select a present function-keyed node and a caller-to-deep value-call triple in the authored fixture. Expected ID selection shares nodeID and the actual Program filename; node Name payload, exact edge count and an independent ID grammar are not asserted.
// @evidence contracts/testing.md#distinguishing-cases Load dotted namespace A.B.C with deep and a caller. Build qualified namespace declarations and calls. Require A.B.C.deep and the caller value-call edge to that qualified declaration.
// @evidence contracts/testing.md#execution-ownership This Go source-unit writes a native project, constructs/closes its driver Program in-process and directly calls Build and presence-only hasEdge. A restored empty linked-plugin manifest excludes ambient hooks; no namespace code execution, dump serialization, installed consumer or product process runs.
func TestNamespaceDottedFormQualifiesDeeply(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/main.ts"]
}
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export namespace A.B.C {
  export function deep(): void {}
}

export function caller(): void {
  A.B.C.deep();
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
  path := sourceFile(t, prog, "main.ts").FileName()

  deep := nodeID(path, "A.B.C.deep", NodeFunction)
  caller := nodeID(path, "caller", NodeFunction)

  if _, ok := graph.Nodes[deep]; !ok {
    t.Fatalf("missing deeply-namespaced node %q; nodes: %v", deep, graph.Nodes)
  }
  if !hasEdge(graph, caller, deep, EdgeValueCall) {
    t.Fatalf("missing value-call edge caller -> A.B.C.deep; edges: %v", graph.Edges)
  }
}
