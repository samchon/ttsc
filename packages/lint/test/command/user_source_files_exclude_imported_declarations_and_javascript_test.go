package linthost

import (
  "path/filepath"
  "reflect"
  "sort"
  "testing"
)

// TestUserSourceFilesExcludeImportedDeclarationsAndJavaScript verifies the read
// scope widens for authored TypeScript alone.
//
// This is the negative twin of the imported-source widening: an unselected
// `.d.ts` is typings rather than authored source (the bundled `lib.*.d.ts` set
// and every published package's typings arrive the same way), and unselected
// JavaScript is only in the Program because `allowJs` let an import pull it in.
// Admitting either would put lint diagnostics on files the project never wrote.
//
// 1. Materialize a tsconfig whose only root is `src/root.ts`, with allowJs on.
// 2. Import a JavaScript module and a declaration file from that root.
// 3. Assert userSourceFiles returns the selected root alone.
func TestUserSourceFilesExcludeImportedDeclarationsAndJavaScript(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "allowJs": true,
    "module": "commonjs",
    "strict": true,
    "target": "ES2022"
  },
  "files": [
    "src/root.ts"
  ]
}
`)
  writeFile(t, filepath.Join(root, "src", "root.ts"), "import \"./helper\";\nimport type { Shape } from \"./shapes\";\nexport const shape: Shape = { kind: \"circle\" };\n")
  writeFile(t, filepath.Join(root, "src", "helper.js"), "module.exports = {};\n")
  writeFile(t, filepath.Join(root, "src", "shapes.d.ts"), "export interface Shape {\n  kind: string;\n}\n")

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

  expected := []string{"src/root.ts"}
  if !reflect.DeepEqual(names, expected) {
    t.Fatalf("userSourceFiles() = %v, want %v", names, expected)
  }
}
