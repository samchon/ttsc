package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEmitRawDeclarationDirOutputsSurviveOutDirContainment Verifies that EmitAllRaw retains outDir JavaScript and separate declarationDir outputs while rejecting dependency-adjacent writes.
//
// Legitimate declarations outside outDir contrast with forbidden writes beside dependency sources.
//
// 1. Reuse the self-referenced dependency layout with `declaration` and `declarationDir: "types"` added to the nested project.
// 2. Load with ForceEmit and run EmitAllRaw.
// 3. Assert `dist/main.js` and `types/main.d.ts` are written.
// 4. Assert every write lands under `dist/` or `types/` and none lands beside dependency sources.
//
// @evidence contracts/testing.md#behavioral-verification EmitAllRaw retains outDir JavaScript and separate declarationDir outputs while rejecting dependency-adjacent writes.
// @evidence contracts/testing.md#independent-expectations The authored dist/types roots define allowed locations independently of the containment predicate.
// @evidence contracts/testing.md#distinguishing-cases Legitimate declarations outside outDir contrast with forbidden writes beside dependency sources.
// @evidence contracts/testing.md#execution-ownership LoadProgram and a recording writer execute directly in Go over a temporary project. Go discovers TestEmitRawDeclarationDirOutputsSurviveOutDirContainment under ./test/driver.
func TestEmitRawDeclarationDirOutputsSurviveOutDirContainment(t *testing.T) {
  root := t.TempDir()
  writeSelfReferencedDependencyProject(t, root)
  writeProjectFile(t, root, "proj/tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "bundler",
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "declarationDir": "types",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
`)
  project := filepath.Join(root, "proj")
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
  outDir := filepath.ToSlash(filepath.Join(project, "dist")) + "/"
  declarationDir := filepath.ToSlash(filepath.Join(project, "types")) + "/"
  sawJs, sawDts := false, false
  sawJsAtOutDir, sawDtsAtDeclarationDir := false, false
  for _, file := range written {
    if !strings.HasPrefix(file, outDir) && !strings.HasPrefix(file, declarationDir) {
      t.Fatalf("emit escaped outDir and declarationDir: %s (all writes: %v)", file, written)
    }
    if strings.HasSuffix(file, "/main.js") {
      sawJs = true
    }
    if strings.HasSuffix(file, "/main.d.ts") {
      sawDts = true
    }
    if file == outDir+"main.js" {
      sawJsAtOutDir = true
    }
    if file == declarationDir+"main.d.ts" {
      sawDtsAtDeclarationDir = true
    }
  }
  if !sawJs {
    t.Fatalf("project's own main.js was not emitted under outDir: %v", written)
  }
  if !sawDts {
    t.Fatalf("declarationDir output main.d.ts was swallowed by the containment guard: %v", written)
  }
  if !sawJsAtOutDir || !sawDtsAtDeclarationDir {
    t.Fatalf("missing configured dist/main.js or types/main.d.ts: %v", written)
  }
}
