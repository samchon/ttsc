package linthost

import (
  "path/filepath"
  "reflect"
  "sort"
  "testing"
)

// TestProjectSourceFilesFollowTsconfigSelection verifies the project's own
// source set stays exactly what the tsconfig selected.
//
// This set is the write boundary. `format` walks it instead of the wider read
// scope, and `fix` applies edits only inside it, so a project never rewrites a
// sibling package it merely imports (samchon/ttsc#1065). It is the read scope's
// negative twin over one fixture: the imported TypeScript that joins
// userSourceFiles must not appear here, while a selected declaration file must.
//
// 1. Materialize a tsconfig with TS, declaration, and JSON root files.
// 2. Import an extra TS file that is not a tsconfig root.
// 3. Assert projectSourceFiles returns the selected TS and declaration roots.
//
// @evidence contracts/testing.md#behavioral-verification Actual compiler loading includes extra.ts and data.json once each, but projectSourceFiles returns exactly selected root.d.ts and root.ts, protecting the write boundary from imported TypeScript and JSON.
// @evidence contracts/testing.md#independent-expectations Authored tsconfig roots/imports and a literal complete expected path list independently define writable membership; direct Program population counts prove excluded controls were resolved rather than absent.
// @evidence contracts/testing.md#distinguishing-cases Selected declarations remain project-owned while imported TypeScript joins only the read scope and selected/imported JSON remains excluded from lint syntax; exact two-path membership rejects omissions or extra files.
// @evidence contracts/testing.md#execution-ownership Supported compiler loading and projectSourceFiles execute directly in one Go process on temporary JSON/TypeScript fixtures with deferred Program closure; no installed consumer, native build, evaluator or external compiler runs.
func TestProjectSourceFilesFollowTsconfigSelection(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "allowJs": true,
    "module": "commonjs",
    "resolveJsonModule": true,
    "strict": true,
    "target": "ES2022"
  },
  "files": [
    "src/root.d.ts",
    "src/root.ts",
    "src/data.json"
  ]
}
`)
  writeFile(t, filepath.Join(root, "src", "root.d.ts"), "declare var value: string;\n")
  writeFile(t, filepath.Join(root, "src", "root.ts"), "import \"./extra\";\nimport data from \"./data.json\";\nexport const value = data.ok;\n")
  writeFile(t, filepath.Join(root, "src", "extra.ts"), "export const extra = 1;\n")
  writeFile(t, filepath.Join(root, "src", "data.json"), "{\"ok\": true}\n")

  prog, diags, err := loadProgram(root, "tsconfig.json", loadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %#v", diags)
  }
  defer prog.close()
  imported := map[string]int{"src/extra.ts": 0, "src/data.json": 0}
  for _, file := range prog.tsProgram.SourceFiles() {
    name := filepath.ToSlash(filepath.Clean(file.FileName()))
    for expected := range imported {
      if name == filepath.ToSlash(filepath.Join(root, expected)) {
        imported[expected]++
      }
    }
  }
  for name, count := range imported {
    if count != 1 {
      t.Fatalf("upstream Program must read excluded source %s exactly once, got %d", name, count)
    }
  }

  names := make([]string, 0)
  for _, file := range prog.projectSourceFiles() {
    rel, err := filepath.Rel(root, file.FileName())
    if err != nil {
      t.Fatal(err)
    }
    names = append(names, filepath.ToSlash(rel))
  }
  sort.Strings(names)

  expected := []string{"src/root.d.ts", "src/root.ts"}
  if !reflect.DeepEqual(names, expected) {
    t.Fatalf("projectSourceFiles() = %v, want %v", names, expected)
  }
}
