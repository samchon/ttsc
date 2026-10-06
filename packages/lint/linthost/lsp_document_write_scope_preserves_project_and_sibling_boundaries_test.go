package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestLSPDocumentWriteScopePreservesProjectAndSiblingBoundaries contrasts a
// document command with the unchanged project-wide CLI write scope. The same
// native Program retains both authored files, but only the selected document
// receives file-rule findings in the document command's cycle.
//
// @evidence contracts/testing.md#behavioral-verification The real loaded Program and no-var engine produce one main finding for the document cycle and two findings for the CLI write cycle; original main and sibling bytes remain unchanged.
// @evidence contracts/testing.md#independent-expectations Two authored var statements independently require two project findings, while a main-only command can return only its one finding. Native source filenames identify ownership independently of returned finding text.
// @evidence contracts/testing.md#distinguishing-cases Main and sibling both violate the same rule; document versus project write scope distinguishes skipped sibling work from accidentally dropping a selected document or narrowing compiler membership. A fresh project cycle is used for the second scope.
// @evidence contracts/testing.md#execution-ownership This Go unit uses the existing seeded project, in-process loadProgram and real Engine. It launches no Node evaluator, installed host or native executable and owns both temporary files through t.TempDir.
func TestLSPDocumentWriteScopePreservesProjectAndSiblingBoundaries(t *testing.T) {
  const main = "var main = 1;\nexport {};\n"
  const sibling = "var sibling = 2;\nexport {};\n"
  root := seedLintProject(t, main)
  siblingPath := filepath.Join(root, "src", "sibling.ts")
  if err := os.WriteFile(siblingPath, []byte(sibling), 0o600); err != nil {
    t.Fatal(err)
  }
  prog, diagnostics, err := loadProgram(root, filepath.Join(root, "tsconfig.json"), loadProgramOptions{forceNoEmit: true})
  if err != nil || len(diagnostics) != 0 || prog == nil {
    t.Fatalf("load project: %v, diagnostics=%v", err, diagnostics)
  }
  defer prog.close()
  targetPath := filepath.Join(root, "src", "main.ts")
  target := prog.sourceFileByPath(targetPath)
  if target == nil || prog.sourceFileByPath(siblingPath) == nil {
    t.Fatal("both authored documents must remain in the compiler Program")
  }
  engine := NewEngine(RuleConfig{"no-var": SeverityError})
  selected := prog.runDocumentWriteScopedCycle(engine, target)
  if len(selected) != 1 || selected[0].File != target {
    t.Fatalf("document findings: %#v", selected)
  }
  prog.projectCycle = nil
  project := prog.runWriteScopedCycle(engine)
  if len(project) != 2 {
    t.Fatalf("CLI project scope lost a sibling finding: %#v", project)
  }
  for filename, want := range map[string]string{targetPath: main, siblingPath: sibling} {
    got, err := os.ReadFile(filename)
    if err != nil || string(got) != want {
      t.Fatalf("original document changed: %s, %v, %q", filename, err, got)
    }
  }
}
