package linthost

import (
  "path/filepath"
  "reflect"
  "sort"
  "testing"
)

// TestUserSourceFilesSpanProgramTypeScriptSources verifies the lint read scope
// covers TypeScript the Program reached through an import.
//
// The tsconfig file list used to be the whole boundary, so a source that
// entered the Program through an import was type-checked and never linted —
// one invocation holding two views of one Program (samchon/ttsc#1065). The
// widening is limited to authored TypeScript: a JSON module carries no lint
// source, so it must stay out even though the Program reads it.
//
// 1. Materialize a tsconfig with TS, declaration, and JSON root files.
// 2. Import an extra TS file and a JSON module that are not tsconfig roots.
// 3. Assert the imported TS file joins the selected roots and the JSON does not.
func TestUserSourceFilesSpanProgramTypeScriptSources(t *testing.T) {
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
  for _, file := range prog.userSourceFiles() {
    rel, err := filepath.Rel(root, file.FileName())
    if err != nil {
      t.Fatal(err)
    }
    names = append(names, filepath.ToSlash(rel))
  }
  sort.Strings(names)

  expected := []string{"src/extra.ts", "src/root.d.ts", "src/root.ts"}
  if !reflect.DeepEqual(names, expected) {
    t.Fatalf("userSourceFiles() = %v, want %v", names, expected)
  }
}
