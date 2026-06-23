package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestValueCallEdgesCoverJsxComponents verifies that a JSX component use
// (`<Child />`) is a value-call edge to the component — the relationship a React
// codebase is built from, which a call-expression-only walk silently dropped. An
// intrinsic tag (`<div />`) resolves to nothing and adds no edge, so the walk
// distinguishes a component use from a host element.
//
//  1. Compile a .tsx fixture where Parent renders <Child /> inside a <div>.
//  2. Build the graph.
//  3. Assert a Parent -> Child value-call edge exists.
func TestValueCallEdgesCoverJsxComponents(t *testing.T) {
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

  parent := nodeID(path, "Parent", NodeFunction)
  child := nodeID(path, "Child", NodeFunction)

  if !hasEdge(graph, parent, child, EdgeValueCall) {
    t.Fatalf("missing value-call edge Parent -> Child (JSX component use); edges: %v", graph.Edges)
  }

  // The intrinsic `<div>` host element resolves to nothing and must add no edge.
  // Without this negative twin, a regression that started resolving intrinsic
  // tags would fill every React codebase's call graph with host-element noise
  // while the positive assertion above still passed.
  for _, edge := range graph.Edges {
    if edge.From != parent {
      continue
    }
    if to := graph.Nodes[edge.To]; to != nil && to.Name == "div" {
      t.Fatalf("intrinsic <div> produced a spurious value-call edge from Parent: %v", edge)
    }
  }
}
