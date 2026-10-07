//go:build windows

package linthost

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver/windowsjunction"
)

// TestWindowsProjectSourceSelectionPreservesPhysicalAliases verifies that
// distinct Program spellings of one selected native file remain writable.
//
// @evidence contracts/testing.md#behavioral-verification Actual compiler loading through two real directory junctions produces two AST spellings of one backing file. Both source projections and writable findings retain both, while an unrelated native source is rejected.
// @evidence contracts/testing.md#independent-expectations The config selects owned/main.ts and both independently created junctions target real/main.ts; native backing identity establishes ownership, not the compiler's AST pointer. outside.ts has a different backing file.
// @evidence contracts/testing.md#distinguishing-cases The imported alias must miss direct root-map lookup and still pass physical fallback. The configured AST and imported alternate AST contrast an unrelated native file; portable selected/imported scope and bundled identity have sibling coverage.
// @evidence contracts/testing.md#execution-ownership This Windows unit directly loads the actual Program and invokes projections and the writable guard. windowsjunction.Create prepares real temporary filesystem inputs; no product subprocess, native compilation or installed consumer runs.
func TestWindowsProjectSourceSelectionPreservesPhysicalAliases(t *testing.T) {
  root := t.TempDir()
  real := filepath.Join(root, "real")
  writeFile(t, filepath.Join(real, "main.ts"), "import '../alias/main';\nexport const owned = 1;\n")
  writeFile(t, filepath.Join(root, "outside.ts"), "export const outside = 1;\n")
  for _, name := range []string{"owned", "alias"} {
    if err := windowsjunction.Create(filepath.Join(root, name), real); err != nil {
      t.Fatal(err)
    }
  }
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{"compilerOptions":{"target":"ES2022","module":"commonjs","preserveSymlinks":true},"files":["owned/main.ts"]}`)
  prog, diags, err := loadProgram(root, "tsconfig.json", loadProgramOptions{})
  if err != nil || len(diags) != 0 {
    t.Fatalf("load: err=%v diagnostics=%v", err, diags)
  }
  defer prog.close()
  configured := prog.tsProgram.GetSourceFile(filepath.ToSlash(filepath.Join(root, "owned", "main.ts")))
  imported := prog.tsProgram.GetSourceFile(filepath.ToSlash(filepath.Join(root, "alias", "main.ts")))
  if configured == nil || imported == nil || configured == imported {
    t.Fatal("fixture must load distinct configured and imported AST spellings")
  }
  roots := prog.projectSourceFileNames()
  if _, direct := roots[canonicalProjectPath(root, imported.FileName())]; direct {
    t.Fatal("alternate spelling must exercise physical fallback, not direct lookup")
  }
  if !prog.selectedByProject(roots, imported.FileName()) {
    t.Error("physical alias lost selected-file ownership")
  }
  if prog.selectedByProject(roots, filepath.Join(root, "outside.ts")) {
    t.Error("unrelated native file acquired selected-file ownership")
  }
  for _, name := range []string{"lint", "write"} {
    projection := prog.userSourceFiles
    if name == "write" {
      projection = prog.projectSourceFiles
    }
    files := projection()
    hasConfigured, hasImported := false, false
    for _, file := range files {
      hasConfigured = hasConfigured || file == configured
      hasImported = hasImported || file == imported
    }
    if len(files) != 2 || !hasConfigured || !hasImported {
      t.Errorf("%s source membership must retain exactly both native AST spellings", name)
    }
  }
  selected := []*Finding{{File: configured}, {File: imported}}
  if got := prog.projectWritableFindings(selected); len(got) != 2 || got[0] != selected[0] || got[1] != selected[1] {
    t.Errorf("writable findings=%v, want both native AST spellings", got)
  }
}
