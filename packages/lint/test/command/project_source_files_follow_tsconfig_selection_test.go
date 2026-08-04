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
