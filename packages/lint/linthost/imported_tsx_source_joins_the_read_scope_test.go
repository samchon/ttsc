package linthost

import (
  "path/filepath"
  "reflect"
  "sort"
  "testing"
)

// TestImportedTsxSourceJoinsTheReadScope verifies an imported `.tsx` file
// joins the read scope when the config names only a `.ts` root.
//
// The extension table names four suffixes, and a table can be right while the
// code path that consults it only ever sees one of them. A React or Solid
// codebase imports components across package boundaries, so `.tsx` is the
// extension exercised here through an import rather than through the
// tsconfig selection. This case does not exercise `.mts` or `.cts`.
//
// 1. Select a single `.ts` root in the tsconfig.
// 2. Import a `.tsx` module the selection does not name.
// 3. Assert the imported `.tsx` file joins the read scope.
//
// @evidence contracts/testing.md#behavioral-verification Actual compiler Program rooted only at src/root.ts admits imported widget.tsx into the lint user source list, comparing the complete sorted list against exactly those two authored paths.
// @evidence contracts/testing.md#independent-expectations The independently authored tsconfig root and TSX import fixture define literal expected membership rather than reading the compiler root list as the expected outcome.
// @evidence contracts/testing.md#distinguishing-cases Rooted TS versus unselected TSX isolates extension-aware widening; exact cardinality/path list rejects omission or extra declaration/library sources.
// @evidence contracts/testing.md#execution-ownership Real loadProgram and userSourceFiles operate directly against supported compiler APIs with deferred closure and a temporary filesystem fixture; no native plugin build, installed React package, Node evaluator or compiler subprocess runs.
func TestImportedTsxSourceJoinsTheReadScope(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "jsx": "preserve",
    "module": "commonjs",
    "strict": true,
    "target": "ES2022"
  },
  "files": [
    "src/root.ts"
  ]
}
`)
  writeFile(t, filepath.Join(root, "src", "root.ts"), "import { widget } from \"./widget\";\nexport const value = widget;\n")
  writeFile(t, filepath.Join(root, "src", "widget.tsx"), "export const widget = 1;\n")

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

  expected := []string{"src/root.ts", "src/widget.tsx"}
  if !reflect.DeepEqual(names, expected) {
    t.Fatalf("userSourceFiles() = %v, want %v", names, expected)
  }
}
