package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestTypeRefEdgesCoverTypeofAsSatisfies verifies that the type-position shapes
// beyond a plain `Foo` annotation produce the selected type-ref edges:
//
//   - `typeof value`      -> the value it queries (an EntityName, not a TypeReference)
//   - `x as Target`       -> Target (the assertion's type)
//   - `expr satisfies T`  -> T (the satisfies type)
//
// `as` and `satisfies` carry an ordinary TypeReference the recursion already
// reaches; `typeof` names its value through an EntityName, which a
// TypeReference-only walk would miss. All three must produce an edge so an
// graph records the selected dependency. No downstream impact query runs.
// coerce also has a Target return annotation, so its edge alone cannot prove
// assertion traversal; assertionOnly supplies the same expression without it.
//
// 1. Load typeof settings, an as Target assertion and a satisfies Config expression.
// 2. Build the type-reference relations.
// 3. Require SettingsShape-to-settings, coerce-to-Target and config-to-Config type references.
//
// @evidence contracts/testing.md#behavioral-verification Require SettingsShape-to-settings, coerce-to-Target and config-to-Config type references.
// @evidence contracts/testing.md#independent-expectations Literal triples require SettingsShape to settings, coerce and assertionOnly to Target, and config to Config. assertionOnly has no Target return annotation, distinguishing assertion traversal that the original coerce edge alone cannot authenticate. The typeof and satisfies inputs likewise name their selected targets.
// @evidence contracts/testing.md#distinguishing-cases Load typeof settings, an as Target assertion and a satisfies Config expression. Build the type-reference relations. Require SettingsShape-to-settings, coerce-to-Target and config-to-Config type references.
// @evidence contracts/testing.md#execution-ownership Owns temporary native config/source files and a directly loaded library Program, closes it, and restores an empty linked-plugin manifest. Build and edge-presence checks run in this process using its actual filename and shared nodeID encoder; this is not an independent identity or span oracle. No product CLI, installation, emitted expression evaluation, or downstream impact query runs.
func TestTypeRefEdgesCoverTypeofAsSatisfies(t *testing.T) {
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
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export interface Config {}
export interface Target {}

export const settings = { mode: "fast" };

export type SettingsShape = typeof settings;

export function coerce(x: unknown): Target {
  return x as Target;
}

export function assertionOnly(x: unknown) {
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

  settingsShape := nodeID(path.AsString(), "SettingsShape", NodeTypeAlias)
  settings := nodeID(path.AsString(), "settings", NodeVariable)
  coerce := nodeID(path.AsString(), "coerce", NodeFunction)
  target := nodeID(path.AsString(), "Target", NodeInterface)
  config := nodeID(path.AsString(), "config", NodeVariable)
  configType := nodeID(path.AsString(), "Config", NodeInterface)

  if !hasEdge(graph, settingsShape, settings, EdgeTypeRef) {
    t.Errorf("missing type-ref edge SettingsShape -> settings (typeof query)")
  }
  if !hasEdge(graph, coerce, target, EdgeTypeRef) {
    t.Errorf("missing type-ref edge coerce -> Target (as assertion)")
  }
  if !hasEdge(graph, nodeID(path.AsString(), "assertionOnly", NodeFunction), target, EdgeTypeRef) {
    t.Errorf("missing type-ref edge assertionOnly -> Target without a return annotation")
  }
  if !hasEdge(graph, config, configType, EdgeTypeRef) {
    t.Errorf("missing type-ref edge config -> Config (satisfies)")
  }
  if t.Failed() {
    t.Logf("edges: %v", graph.Edges)
  }
}
