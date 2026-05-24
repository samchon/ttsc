package linthost

import (
  "path/filepath"
  "reflect"
  "sort"
  "testing"
)

// TestUserSourceFilesFollowsTsconfigRoots verifies lint and format walk the
// same source roots selected by tsconfig.
//
// Program.SourceFiles can contain imported implementation files and JSON
// modules that are not part of the root tsconfig file list. Benchmark parity
// requires the host to use parsedConfig.fileNames as the boundary, while still
// keeping user-authored declaration files selected by the project.
//
// 1. Materialize a tsconfig with TS, declaration, and JSON root files.
// 2. Import an extra TS file that is not a tsconfig root.
// 3. Assert userSourceFiles returns only TS/JS roots from parsedConfig.fileNames.
func TestUserSourceFilesFollowsTsconfigRoots(t *testing.T) {
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

  expected := []string{"src/root.d.ts", "src/root.ts"}
  if !reflect.DeepEqual(names, expected) {
    t.Fatalf("userSourceFiles() = %v, want %v", names, expected)
  }
}
