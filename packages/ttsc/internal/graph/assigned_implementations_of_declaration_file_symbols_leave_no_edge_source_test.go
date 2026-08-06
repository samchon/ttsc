package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// ambientGlobalFixtureTSConfig compiles a project that declares an ambient
// global in its own `.d.ts` and assigns the implementation in a sibling source.
// Both files are named because a global augmentation only reaches the program
// when its declaration file is an input.
const ambientGlobalFixtureTSConfig = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/globals.d.ts", "src/main.ts"]
}
`

// TestAssignedImplementationsOfDeclarationFileSymbolsLeaveNoEdgeSource verifies
// that assigning a function to a symbol declared in a declaration file records
// no edge leaving the external boundary leaf that symbol enters the graph as.
//
// An external leaf has no outgoing side: the graph never walks a dependency's
// internals, and no shard may hold an edge whose source is one — an external
// node is owned by the non-source external shard, which is forbidden to own
// edges. Attributing the assigned body to it therefore did not merely misplace
// facts (with evidence offsets from the implementation read against the
// declaration file); it produced a snapshot `ttscgraph serve` could not
// assemble, so every request against such a project failed. The calls the body
// makes are not lost by refusing it: the module that runs the assignment owns
// them.
//
//  1. Compile a fixture whose `src/globals.d.ts` declares `var patched` in a
//     global augmentation and whose `src/main.ts` assigns an arrow function to
//     it that calls a local `helper`.
//  2. Build the graph.
//  3. Assert no edge leaves an external node, and that `main.ts`'s module node
//     still owns the value-call edge to `helper`.
func TestAssignedImplementationsOfDeclarationFileSymbolsLeaveNoEdgeSource(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), ambientGlobalFixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "globals.d.ts"), `declare global {
  var patched: (message: string) => void;
}
export {};
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export function helper(): void {}
patched = (message: string): void => {
  helper();
};
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
  mainPath := sourceFile(t, prog, "main.ts").FileName()

  for _, edge := range graph.Edges {
    node, ok := graph.Nodes[edge.From]
    if ok && node.External {
      t.Fatalf("edge leaves the external boundary: %s -> %s (%s), source declared in %s", edge.From, edge.To, edge.Kind, node.File)
    }
  }

  module := moduleID(mainPath)
  helper := nodeID(mainPath, "helper", NodeFunction)
  if !hasEdge(graph, module, helper, EdgeValueCall) {
    t.Fatalf("the assigned body's call to helper is not owned by the running module; edges: %v", graph.Edges)
  }
}
