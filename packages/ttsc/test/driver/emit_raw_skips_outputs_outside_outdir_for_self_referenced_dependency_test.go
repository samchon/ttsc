package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEmitRawSkipsOutputsOutsideOutDirForSelfReferencedDependency verifies
// forced emit confines EmitAllRaw output to the project's outDir.
//
// Locks the outputEscapesOutDir guard in the EmitAllRaw WriteFile funnel
// (issue #293). A project nested inside a dependency's directory resolves the
// dependency's name by package self-reference — no node_modules hop — so the
// dependency's `.ts` sources are not classified as external-library files and
// stay in the forced-emit set. tsgo then computes their output paths relative
// to the common source directory, which lands the compiled `.js` next to the
// dependency's own sources, outside the project entirely. The guard must skip
// those writes while the project's own file still emits under outDir.
//
// 1. Materialize a dependency package whose `exports` points at raw `.ts`,
//    with the consuming project nested inside the package directory.
// 2. Load the project with ForceEmit and run EmitAllRaw.
// 3. Assert the project's main.js is written under outDir and no write
//    targets the dependency's source tree.
func TestEmitRawSkipsOutputsOutsideOutDirForSelfReferencedDependency(t *testing.T) {
  root := t.TempDir()
  project := writeSelfReferencedDependencyProject(t, root)
  prog, diags, err := driver.LoadProgram(project, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()
  written := []string{}
  _, emitDiags, err := prog.EmitAllRaw(func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    written = append(written, filepath.ToSlash(fileName))
    return nil
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(emitDiags) != 0 {
    t.Fatalf("unexpected emit diagnostics: %#v", emitDiags)
  }
  assertOutputsConfinedToOutDir(t, project, written)
}

// writeSelfReferencedDependencyProject materializes the #293 layout: a
// dependency package exporting raw TypeScript, with the consuming project
// nested inside the package directory so the import resolves by package
// self-reference. Returns the project directory.
func writeSelfReferencedDependencyProject(t *testing.T, root string) string {
  t.Helper()
  writeProjectFile(t, root, "package.json", `{
  "name": "dep",
  "version": "1.0.0",
  "exports": { ".": "./src/index.ts" }
}
`)
  writeProjectFile(t, root, "src/index.ts", `export * from "./extra";
export const dep: number = 1;
`)
  writeProjectFile(t, root, "src/extra.ts", `export const extra: string = "x";
`)
  writeProjectFile(t, root, "proj/tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "bundler",
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
`)
  writeProjectFile(t, root, "proj/src/main.ts", `import { dep } from "dep";
export const x: number = dep;
`)
  return filepath.Join(root, "proj")
}

// assertOutputsConfinedToOutDir asserts the project's own main.js was emitted
// under <project>/dist and that no recorded write escaped that directory.
func assertOutputsConfinedToOutDir(t *testing.T, project string, written []string) {
  t.Helper()
  outDir := filepath.ToSlash(filepath.Join(project, "dist")) + "/"
  sawMain := false
  for _, file := range written {
    if !strings.HasPrefix(file, outDir) {
      t.Fatalf("emit escaped outDir: %s (all writes: %v)", file, written)
    }
    if strings.HasSuffix(file, "/main.js") {
      sawMain = true
    }
  }
  if !sawMain {
    t.Fatalf("project's own main.js was not emitted under outDir: %v", written)
  }
}
