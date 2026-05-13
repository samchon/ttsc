package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverProgramSourcesAndRawEmit verifies public program inspection and
// unmodified TypeScript-Go emit through the driver facade.
//
// This keeps the read-only Program facade behavior covered separately from the
// rewrite pipeline, including declaration filtering.
//
// 1. Load a project containing one source file and one declaration file.
// 2. Assert public source enumeration filters declarations.
// 3. Emit raw JavaScript through a caller-provided WriteFile callback.
func TestDriverProgramSourcesAndRawEmit(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: the declaration file is included deliberately so
  // SourceFiles can prove it exposes user-authored implementation files only.
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin",
    "declaration": true,
    "strict": true
  },
  "files": ["index.ts", "types.d.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const value = 1;
`)
  writeProjectFile(t, root, "types.d.ts", `export interface Named { name: string }
`)

  // Program assertion: SourceFile accepts OS paths, while SourceFiles filters
  // declaration-only entries from the user-facing list.
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()
  if prog.SourceFile(filepath.Join(root, "index.ts")) == nil {
    t.Fatal("SourceFile should find index.ts")
  }
  sources := prog.SourceFiles()
  if len(sources) != 1 || strings.HasSuffix(sources[0].FileName(), ".d.ts") {
    t.Fatalf("SourceFiles should exclude declarations: %#v", sources)
  }

  // Emit assertion: raw emit bypasses ttsc rewrites while still using the same
  // program and callback-driven output contract.
  emitted := map[string]string{}
  _, emitDiags, err := prog.EmitAllRaw(func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fileName)] = text
    return nil
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(emitDiags) != 0 {
    t.Fatalf("unexpected emit diagnostics: %#v", emitDiags)
  }
  if !strings.Contains(emitted["index.js"], "exports.value") {
    t.Fatalf("raw emit missing index.js output: %#v", emitted)
  }
}
