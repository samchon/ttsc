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
// prefix. A regression in either would silently drop every declaration in a
// dotted (or deeply nested) namespace — the idiom of .d.ts-heavy and
// proto-generated codebases.
func TestNamespaceDottedFormQualifiesDeeply(t *testing.T) {
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
