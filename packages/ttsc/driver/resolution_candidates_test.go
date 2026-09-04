package driver

import (
  "fmt"
  "os"
  "path/filepath"
  "slices"
  "testing"
)

func TestTransformGraphReplaysCompilerResolutionSemantics(t *testing.T) {
  root := t.TempDir()
  files := map[string]string{
    "package.json": `{
  "name": "resolver-fixture",
  "type": "module",
  "imports": { "#internal": "./src/internal.js" },
  "exports": { "./self": "./src/self.js" }
}`,
    "tsconfig.json": `{
  "compilerOptions": {
    "allowJs": true,
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "moduleSuffixes": [".native", ""],
    "target": "es2022",
    "types": ["*"]
  },
  "files": ["src/main.ts"]
}`,
    "src/main.ts": `/// <reference path="./ambient" />
/// <reference types="fixture-types" />
import { internal } from "#internal";
import { self } from "resolver-fixture/self";
import type { Folder } from "./folder/index.js";
export const value: Folder = { value: internal + self };
`,
    "src/ambient.d.ts": `declare const fixturePathGlobal: string;
`,
    "src/internal.js": `export const internal = "internal";
`,
    "src/self.js": `export const self = "self";
`,
    "src/folder/index.d.ts": `export interface Folder { value: string }
`,
    "node_modules/@types/fixture-types/package.json": `{"name":"@types/fixture-types","types":"index.d.ts","version":"1.0.0"}
`,
    "node_modules/@types/fixture-types/index.d.ts": `declare const fixtureGlobal: string;
`,
  }
  for name, contents := range files {
    location := filepath.Join(root, filepath.FromSlash(name))
    if err := os.MkdirAll(filepath.Dir(location), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(location, []byte(contents), 0o644); err != nil {
      t.Fatal(err)
    }
  }

  prog, diagnostics, err := LoadProgram(root, "tsconfig.json", LoadProgramOptions{ForceNoEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diagnostics) != 0 {
    t.Fatalf("unexpected diagnostics: %#v", diagnostics)
  }
  defer prog.Close()

  graph := NewTransformGraph(prog, root)
  if graph == nil {
    t.Fatal("NewTransformGraph returned nil")
  }
  source := filepath.ToSlash(filepath.Join("src", "main.ts"))
  candidates := graph.Candidates[source]
  for _, expected := range []string{
    "package.json",
    "src/ambient.ts",
    "src/folder/index.native.d.ts",
    "src/internal.native.ts",
    "src/self.native.ts",
  } {
    if !slices.Contains(candidates, filepath.ToSlash(expected)) {
      t.Errorf("exact resolver inputs omit %q: %v", expected, candidates)
    }
  }
  typeRoot := filepath.ToSlash(filepath.Join("node_modules", "@types"))
  if !slices.Contains(graph.ResolutionInputs, typeRoot) {
    t.Fatalf("automatic type-root inputs omit %q: %v", typeRoot, graph.ResolutionInputs)
  }
  entries := graph.InputObservations[typeRoot].AccessibleEntries
  if entries == nil || !slices.Contains(entries.Directories, "fixture-types") {
    t.Fatalf("automatic type-root listing = %#v", entries)
  }
  if len(graph.InputProofFailures) != 0 {
    t.Fatalf("stable exact replay reported failures: %#v", graph.InputProofFailures)
  }

  noResolveRoot := t.TempDir()
  noResolveFiles := map[string]string{
    "tsconfig.json": `{
  "compilerOptions": {
    "allowJs": true,
    "module": "commonjs",
    "noResolve": true,
    "target": "es2022"
  },
  "files": ["src/main.ts"]
}`,
    "src/main.ts":     `import { detached } from "./detached"; export { detached };`,
    "src/detached.js": `export const detached = true;`,
  }
  for name, contents := range noResolveFiles {
    location := filepath.Join(noResolveRoot, filepath.FromSlash(name))
    if err := os.MkdirAll(filepath.Dir(location), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(location, []byte(contents), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  noResolveProgram, _, err := LoadProgram(noResolveRoot, "tsconfig.json", LoadProgramOptions{ForceNoEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  defer noResolveProgram.Close()
  noResolveGraph := NewTransformGraph(noResolveProgram, noResolveRoot)
  noResolveCandidates := noResolveGraph.Candidates[filepath.ToSlash(filepath.Join("src", "main.ts"))]
  if !slices.Contains(noResolveCandidates, filepath.ToSlash(filepath.Join("src", "detached.js"))) {
    t.Fatalf("successful resolution outside the Program graph was dropped: %v", noResolveCandidates)
  }

  projectReferenceRoot := t.TempDir()
  projectReferenceFiles := map[string]string{
    "tsconfig.json": `{
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node10",
    "target": "es2022"
  },
  "files": ["src/main.ts"],
  "references": [{ "path": "./child" }]
}`,
    "src/main.ts": `/// <reference path="../child/lib/reference" />
import { child } from "../child/lib/index.js"; export { child };`,
    "child/tsconfig.json": `{
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "module": "commonjs",
    "outDir": "lib",
    "rootDir": "src",
    "target": "es2022"
  },
  "files": ["src/index.ts", "src/reference.ts"]
}`,
    "child/src/index.ts":     `export const child = true;`,
    "child/src/reference.ts": `export interface ChildReference { value: string }`,
  }
  for name, contents := range projectReferenceFiles {
    location := filepath.Join(projectReferenceRoot, filepath.FromSlash(name))
    if err := os.MkdirAll(filepath.Dir(location), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(location, []byte(contents), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  unbuiltDeclaration := filepath.Join(projectReferenceRoot, "child", "lib", "index.d.ts")
  if _, err := os.Stat(unbuiltDeclaration); !os.IsNotExist(err) {
    t.Fatalf("unbuilt project-reference declaration unexpectedly exists: %v", err)
  }
  projectReferenceProgram, projectReferenceDiagnostics, err := LoadProgram(projectReferenceRoot, "tsconfig.json", LoadProgramOptions{ForceNoEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(projectReferenceDiagnostics) != 0 {
    t.Fatalf("unexpected project-reference diagnostics: %#v", projectReferenceDiagnostics)
  }
  defer projectReferenceProgram.Close()
  projectReferenceGraph := NewTransformGraph(projectReferenceProgram, projectReferenceRoot)
  if len(projectReferenceGraph.InputProofFailures) != 0 {
    t.Fatalf("unbuilt project-reference replay reported failures: %#v", projectReferenceGraph.InputProofFailures)
  }
  projectReferenceSource := filepath.ToSlash(filepath.Join("src", "main.ts"))
  projectReferenceCandidates := projectReferenceGraph.Candidates[projectReferenceSource]
  for _, expected := range []string{
    filepath.ToSlash(filepath.Join("child", "lib", "index.d.ts")),
    filepath.ToSlash(filepath.Join("child", "lib", "reference.d.ts")),
  } {
    if !slices.Contains(projectReferenceCandidates, expected) {
      t.Errorf("unbuilt project-reference declaration %q was not observed: %v", expected, projectReferenceCandidates)
    }
  }
  projectReferenceEdges := projectReferenceGraph.Edges[projectReferenceSource]
  extensionlessReferenceSource := filepath.ToSlash(filepath.Join("child", "src", "reference.ts"))
  if !slices.Contains(projectReferenceEdges, extensionlessReferenceSource) {
    t.Fatalf("extensionless project-reference path did not redirect to %q: %v", extensionlessReferenceSource, projectReferenceEdges)
  }

  semanticRoot := t.TempDir()
  semanticFiles := map[string]string{
    "tsconfig.json": `{
  "compilerOptions": { "module": "commonjs", "target": "es2022", "types": ["*"] },
  "files": ["src/main.ts"]
}`,
    "src/main.ts": `export const value = fixtureTypeGlobal;`,
    "node_modules/@types/fixture-types/index.d.ts": `declare const fixtureTypeGlobal: string;`,
  }
  for name, contents := range semanticFiles {
    location := filepath.Join(semanticRoot, filepath.FromSlash(name))
    if err := os.MkdirAll(filepath.Dir(location), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(location, []byte(contents), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  semanticConfig := filepath.Join(semanticRoot, "tsconfig.json")
  generatedRoot := t.TempDir()
  generatedConfig := filepath.Join(generatedRoot, "tsconfig.json")
  generatedContents := fmt.Sprintf(`{"extends":%q,"compilerOptions":{"strict":true}}`, filepath.ToSlash(semanticConfig))
  if err := os.WriteFile(generatedConfig, []byte(generatedContents), 0o644); err != nil {
    t.Fatal(err)
  }
  t.Setenv(SemanticConfigPathEnv, semanticConfig)
  semanticProgram, semanticDiagnostics, err := LoadProgram(semanticRoot, generatedConfig, LoadProgramOptions{
    ForceNoEmit:        true,
    SemanticConfigPath: semanticConfig,
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(semanticDiagnostics) != 0 {
    t.Fatalf("unexpected generated-wrapper diagnostics: %#v", semanticDiagnostics)
  }
  defer semanticProgram.Close()
  if got := semanticProgram.TSProgram.Options().ConfigFilePath; got != filepath.ToSlash(semanticConfig) {
    t.Fatalf("generated wrapper semantic config = %q, want %q", got, filepath.ToSlash(semanticConfig))
  }
  semanticGraph := NewTransformGraph(semanticProgram, semanticRoot)
  semanticTypeRoot := filepath.ToSlash(filepath.Join("node_modules", "@types"))
  if !slices.Contains(semanticGraph.ResolutionInputs, semanticTypeRoot) {
    t.Fatalf("generated wrapper type-root inputs omit %q: %v", semanticTypeRoot, semanticGraph.ResolutionInputs)
  }
  unmarkedProgram, unmarkedDiagnostics, err := LoadProgram(semanticRoot, generatedConfig, LoadProgramOptions{ForceNoEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(unmarkedDiagnostics) != 0 {
    t.Fatalf("unexpected unmarked-wrapper diagnostics: %#v", unmarkedDiagnostics)
  }
  defer unmarkedProgram.Close()
  if got := unmarkedProgram.TSProgram.Options().ConfigFilePath; got != filepath.ToSlash(generatedConfig) {
    t.Fatalf("unmarked wrapper inherited ambient semantic config = %q, want %q", got, filepath.ToSlash(generatedConfig))
  }
  invalidProgram, _, err := LoadProgram(semanticRoot, generatedConfig, LoadProgramOptions{SemanticConfigPath: "relative.json"})
  if invalidProgram != nil {
    defer invalidProgram.Close()
  }
  if err == nil {
    t.Fatal("relative semantic config path was accepted")
  }
}
