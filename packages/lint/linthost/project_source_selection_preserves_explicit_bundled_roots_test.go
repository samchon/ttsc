//go:build !noembed

package linthost

import (
  "encoding/json"
  "path/filepath"
  "slices"
  "testing"

  "github.com/microsoft/typescript-go/shim/bundled"
)

// TestProjectSourceSelectionPreservesExplicitBundledRoots verifies that an
// explicitly selected virtual library remains owned while other compiler
// libraries remain outside the project's read and write populations.
//
// @evidence contracts/testing.md#behavioral-verification Actual Program loading includes multiple bundled libraries, but both source projections retain exactly the authored main.ts and explicitly selected lib.es5.d.ts, once each; writable findings retain the selected library and reject a loaded unselected library.
// @evidence contracts/testing.md#independent-expectations The authored files list independently selects one native source and one official bundled address; literal lib.es5.d.ts and main.ts identities establish membership rather than a second projection algorithm.
// @evidence contracts/testing.md#distinguishing-cases Explicit bundled-root inclusion contrasts other demonstrably loaded bundled libraries; the native main.ts control preserves ordinary ownership. Separate native-alias cases own physical spelling equivalence.
// @evidence contracts/testing.md#execution-ownership This public Go unit requires embedded libraries and invokes both source projections and the writable guard in process over temporary config/source inputs, without an installed package, product subprocess or native build. Native noembed ownership belongs to the native source-selection units.
func TestProjectSourceSelectionPreservesExplicitBundledRoots(t *testing.T) {
  root := t.TempDir()
  library := bundled.LibPath() + "/lib.es5.d.ts"
  config, err := json.Marshal(map[string]any{
    "compilerOptions": map[string]any{"target": "ES2022", "strict": true},
    "files":           []string{"main.ts", library},
  })
  if err != nil {
    t.Fatal(err)
  }
  writeFile(t, filepath.Join(root, "tsconfig.json"), string(config))
  writeFile(t, filepath.Join(root, "main.ts"), "export const owned = 1;\n")
  prog, diags, err := loadProgram(root, "tsconfig.json", loadProgramOptions{})
  if err != nil || len(diags) != 0 {
    t.Fatalf("load: err=%v diagnostics=%v", err, diags)
  }
  defer prog.close()
  bundledFiles := 0
  var excluded *Finding
  for _, file := range prog.tsProgram.SourceFiles() {
    if bundled.IsBundled(file.FileName()) {
      bundledFiles++
      if file.FileName() != library && excluded == nil {
        excluded = &Finding{File: file}
      }
    }
  }
  if bundledFiles < 2 {
    t.Fatalf("negative-control libraries were not loaded: %d", bundledFiles)
  }
  for _, name := range []string{"lint", "write"} {
    var files []string
    sources := prog.userSourceFiles
    if name == "write" {
      sources = prog.projectSourceFiles
    }
    for _, file := range sources() {
      files = append(files, filepath.ToSlash(file.FileName()))
    }
    expectedMain := filepath.ToSlash(filepath.Join(root, "main.ts"))
    if len(files) != 2 || !slices.Contains(files, expectedMain) || !slices.Contains(files, library) {
      t.Errorf("%s source membership=%v, want main.ts and explicit %s", name, files, library)
    }
  }
  selected := &Finding{File: prog.tsProgram.GetSourceFile(library)}
  if selected.File == nil || excluded == nil {
    t.Fatal("selected and unselected writable controls must both be loaded")
  }
  if got := prog.projectWritableFindings([]*Finding{selected, excluded}); len(got) != 1 || got[0] != selected {
    t.Errorf("writable findings=%v, want only the explicitly selected bundled library", got)
  }
}
