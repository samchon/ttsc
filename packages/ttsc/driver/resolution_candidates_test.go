package driver

import (
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
    "target": "es2022"
  },
  "files": ["src/main.ts"]
}`,
    "src/main.ts": `/// <reference path="./ambient" />
/// <reference types="fixture-types" />
import { internal } from "#internal";
import { self } from "resolver-fixture/self";
import type { Folder } from "./folder";
export const value: Folder = { value: internal + self };
`,
    "src/ambient.d.ts": `declare const fixturePathGlobal: string;
`,
    "src/internal.js": `export const internal = "internal";
`,
    "src/self.js": `export const self = "self";
`,
    "src/folder/package.json": `{"types":"index.d.ts"}
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
    "src/folder/package.json",
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
}
