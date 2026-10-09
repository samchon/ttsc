package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestValueCallEdgesCoverJsxComponents verifies that a JSX component use
// (`<Child />`) yields the selected Parent-to-Child value-call triple.
// The authored intrinsic negative rejects only a target named exactly div;
// qualified intrinsic property targets, JSX origin, rendered runtime behavior,
// and all component forms are not authenticated by these observations.
//
//  1. Compile a .tsx fixture where Parent renders <Child /> inside a <div>.
//  2. Build the graph.
//  3. Assert a Parent -> Child value-call edge exists.
//
// @evidence contracts/testing.md#behavioral-verification A JSX component use <Child /> inside <div> becomes a value-call edge from Parent to Child. The negative check only rejects an edge from Parent to a node whose Name is exactly div, so it would not catch an edge to the qualified JSX.IntrinsicElements.div property node.
// @evidence contracts/testing.md#independent-expectations The expectations are literal over a .tsx fixture: a value-call edge must run from Parent to Child, and no edge from Parent may target a node whose Name is div.
// @evidence contracts/testing.md#distinguishing-cases Compile a .tsx fixture where Parent renders <Child /> inside a <div>; Build the graph; Assert a Parent -> Child value-call edge exists.
// @evidence contracts/testing.md#execution-ownership Owns temporary native config and TSX source with authored JSX declarations and a directly loaded library Program, closes it, and restores an empty linked-plugin manifest. Build and edge observations run in this process using its actual filename and shared nodeID encoder. No React installation, product CLI, emitted JSX evaluation, or rendered runtime executes.
func TestValueCallEdgesCoverJsxComponents(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "jsx": "preserve",
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/main.tsx"]
}
`)
  writeFile(t, filepath.Join(root, "src", "main.tsx"), `declare namespace JSX {
  interface Element {}
  interface IntrinsicElements {
    div: {};
  }
}
export function Child(): JSX.Element {
  return null as unknown as JSX.Element;
}
export function Parent(): JSX.Element {
  return (
    <div>
      <Child />
    </div>
  );
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
  path := sourceFile(t, prog, "main.tsx").FileName()

  parent := nodeID(path.AsString(), "Parent", NodeFunction)
  child := nodeID(path.AsString(), "Child", NodeFunction)

  if !hasEdge(graph, parent, child, EdgeValueCall) {
    t.Fatalf("missing value-call edge Parent -> Child (JSX component use); edges: %v", graph.Edges)
  }

  // This negative observes only targets named exactly div; it cannot reject a
  // qualified JSX.IntrinsicElements.div target.
  for _, edge := range graph.Edges {
    if edge.From != parent {
      continue
    }
    if to := graph.Nodes[edge.To]; to != nil && to.Name == "div" {
      t.Fatalf("intrinsic <div> produced a spurious value-call edge from Parent: %v", edge)
    }
  }
}
