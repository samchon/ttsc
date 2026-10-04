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
// Admitting either would widen this TypeScript lint scope to imported typings or JavaScript; their exclusion does not claim the project never authored them.
//
// 1. Materialize a tsconfig whose only root is `src/root.ts`, with allowJs on.
// 2. Import a JavaScript module and a declaration file from that root.
// 3. Assert userSourceFiles returns the selected root alone.
//
// @evidence contracts/testing.md#behavioral-verification Actual Program demonstrably reads imported helper.js and shapes.d.ts once each, but userSourceFiles retains only the selected root.ts; complete sorted literal membership excludes both imports.
// @evidence contracts/testing.md#independent-expectations Authored imports, allowJs and literal root.ts expected list independently specify lint ownership; upstream Program source population is a positive observation preventing broken resolution from satisfying exclusion.
// @evidence contracts/testing.md#distinguishing-cases Selected TypeScript contrasts with unselected JavaScript and declarations; explicit import-population counts distinguish lint filtering from failing to load the negative-control sources.
// @evidence contracts/testing.md#execution-ownership Real supported in-process compiler loading and lint source projection execute with deferred program closure against temporary files, without installed packages, native producer compilation, script evaluator or subprocesses.
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
  imported := map[string]int{"src/helper.js": 0, "src/shapes.d.ts": 0}
  for _, file := range prog.tsProgram.SourceFiles() {
    name := filepath.ToSlash(filepath.Clean(file.FileName()))
    for expected := range imported {
      if name == filepath.ToSlash(filepath.Join(root, expected)) { imported[expected]++ }
    }
  }
  for name, count := range imported { if count != 1 { t.Fatalf("upstream Program must actually read excluded import %s exactly once, got %d", name, count) } }

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
