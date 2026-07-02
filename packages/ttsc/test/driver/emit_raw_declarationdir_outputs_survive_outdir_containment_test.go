package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEmitRawDeclarationDirOutputsSurviveOutDirContainment verifies the outDir
// containment guard exempts declarationDir outputs.
//
// Negative twin for the outputEscapesOutDir predicate (issue #293): a
// `declarationDir` sits outside `outDir` by design, so its `.d.ts` outputs
// escape `outDir` legitimately. A guard that only whitelisted `outDir` would
// silently swallow every declaration of a `declaration + declarationDir`
// project; this pins the DeclarationDir branch while the self-referenced
// dependency's own outputs (both `.js` and `.d.ts`) still get skipped.
//
//  1. Reuse the self-referenced dependency layout with `declaration` and
//     `declarationDir: "types"` added to the nested project.
//  2. Load with ForceEmit and run EmitAllRaw.
//  3. Assert `dist/main.js` and `types/main.d.ts` are written.
//  4. Assert every write lands under `dist/` or `types/` — nothing beside the
//     dependency's sources.
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
  }
  if !sawJs {
    t.Fatalf("project's own main.js was not emitted under outDir: %v", written)
  }
  if !sawDts {
    t.Fatalf("declarationDir output main.d.ts was swallowed by the containment guard: %v", written)
  }
}
