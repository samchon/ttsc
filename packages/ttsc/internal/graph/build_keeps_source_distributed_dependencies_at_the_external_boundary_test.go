package graph

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestBuildKeepsSourceDistributedDependenciesAtTheExternalBoundary proves a
// package whose public entry is raw TypeScript remains a referenced leaf rather
// than becoming authored graph content. The resident source text is retained as
// provenance evidence even though its declarations are not walked.
func TestBuildKeepsSourceDistributedDependenciesAtTheExternalBoundary(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs", "strict": true },
  "files": ["src/main.ts"]
}
`)
  writeFile(t, filepath.Join(root, "node_modules", "dep-src", "package.json"), `{
  "name": "dep-src",
  "version": "1.0.0",
  "main": "src/index.ts"
}
`)
  writeFile(t, filepath.Join(root, "node_modules", "dep-src", "src", "index.ts"), `export function dependencyValue(): number { return 1; }
export function dependencyInternal(): number { return dependencyValue(); }
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `import { dependencyValue } from "dep-src";
export function workspaceValue(): number { return dependencyValue() + 1; }
`)

  program, diagnostics, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diagnostics) != 0 {
    t.Fatalf("unexpected diagnostics: %v", diagnostics)
  }
  defer func() { _ = program.Close() }()

  built := Build(program)
  dependency := findNodeByName(built, "dependencyValue")
  if dependency == nil || !dependency.External || !strings.Contains(filepath.ToSlash(dependency.File), "/node_modules/dep-src/") {
    t.Fatalf("dependencyValue should be one external boundary leaf: %+v", dependency)
  }
  if internal := findNodeByName(built, "dependencyInternal"); internal != nil {
    t.Fatalf("unreferenced dependency implementation leaked into the authored graph: %+v", internal)
  }
  workspace := findNodeByName(built, "workspaceValue")
  if workspace == nil || workspace.External {
    t.Fatalf("workspaceValue should remain authored source: %+v", workspace)
  }
  if !hasEdge(built, workspace.ID, dependency.ID, EdgeValueCall) {
    t.Fatalf("missing workspaceValue -> dependencyValue boundary call: %v", built.Edges)
  }

  dependencyTextRetained := false
  for file := range SourceTexts(program) {
    if strings.Contains(filepath.ToSlash(file), "/node_modules/dep-src/") {
      dependencyTextRetained = true
      break
    }
  }
  if !dependencyTextRetained {
    t.Fatal("resident dependency source was removed from provenance text")
  }
}
