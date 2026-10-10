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
// that the graph's modeled external nodes own no outgoing edges after an arrow
// is assigned to an ambient declaration-file symbol. The main module must still
// own the authored call to helper. This does not require an external node for
// the assignment target or execute shard assembly, a server, or client queries.
//
//  1. Compile a fixture whose `src/globals.d.ts` declares `var patched` in a
//     global augmentation and whose `src/main.ts` assigns an arrow function to
//     it that calls a local `helper`.
//  2. Build the graph.
//  3. Assert no edge leaves an external node, and that `main.ts`'s module node
//     still owns the value-call edge to `helper`.
//
// @evidence contracts/testing.md#behavioral-verification After the authored ambient-symbol assignment, no edge whose source resolves to a modeled external node is present, and the main module has the literal helper value-call relation.
// @evidence contracts/testing.md#independent-expectations The expectations follow from the ownership rule stated in the test and are checked over a literal fixture: no edge in the built graph may have an external node as its source, and the main.ts module node (moduleID of its path) must own a value-call edge to the helper node (nodeID of its path). The ids are built by the package's own id functions, so a change to id grammar would not be caught here.
// @evidence contracts/testing.md#distinguishing-cases Compile a fixture whose `src/globals.d.ts` declares `var patched` in a global augmentation and whose `src/main.ts` assigns an arrow function to it that calls a local `helper`; Build the graph; Assert no edge leaves an external node, and that `main.ts`'s module node still owns the value-call edge to `helper`.
// @evidence contracts/testing.md#execution-ownership This graph Go source-unit writes its native temporary project and constructs and closes a driver compiler Program in-process before Build. A restored empty linked-plugin manifest excludes ambient hooks. It installs no consumer and builds or starts no native product command.
func TestAssignedImplementationsOfDeclarationFileSymbolsLeaveNoEdgeSource(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
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

  module := moduleID(mainPath.AsString())
  helper := nodeID(mainPath.AsString(), "helper", NodeFunction)
  if !hasEdge(graph, module, helper, EdgeValueCall) {
    t.Fatalf("the assigned body's call to helper is not owned by the running module; edges: %v", graph.Edges)
  }
}
