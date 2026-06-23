package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestTypeRefEdgesCoverTypeofAsSatisfies verifies that the type-position shapes
// beyond a plain `Foo` annotation are all resolved to type-ref edges:
//
//   - `typeof value`      -> the value it queries (an EntityName, not a TypeReference)
//   - `x as Target`       -> Target (the assertion's type)
//   - `expr satisfies T`  -> T (the satisfies type)
//
// `as` and `satisfies` carry an ordinary TypeReference the recursion already
// reaches; `typeof` names its value through an EntityName, which a
// TypeReference-only walk would miss. All three must produce an edge so an
// impact query sees the dependency.
func TestTypeRefEdgesCoverTypeofAsSatisfies(t *testing.T) {
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
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export interface Config {}
export interface Target {}

export const settings = { mode: "fast" };

export type SettingsShape = typeof settings;

export function coerce(x: unknown): Target {
  return x as Target;
}

export const config = { a: 1 } satisfies Config;
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

  settingsShape := nodeID(path, "SettingsShape", NodeTypeAlias)
  settings := nodeID(path, "settings", NodeVariable)
  coerce := nodeID(path, "coerce", NodeFunction)
  target := nodeID(path, "Target", NodeInterface)
  config := nodeID(path, "config", NodeVariable)
  configType := nodeID(path, "Config", NodeInterface)

  if !hasEdge(graph, settingsShape, settings, EdgeTypeRef) {
    t.Errorf("missing type-ref edge SettingsShape -> settings (typeof query)")
  }
  if !hasEdge(graph, coerce, target, EdgeTypeRef) {
    t.Errorf("missing type-ref edge coerce -> Target (as assertion)")
  }
  if !hasEdge(graph, config, configType, EdgeTypeRef) {
    t.Errorf("missing type-ref edge config -> Config (satisfies)")
  }
  if t.Failed() {
    t.Logf("edges: %v", graph.Edges)
  }
}
