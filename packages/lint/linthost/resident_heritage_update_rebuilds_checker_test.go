package linthost

import (
  "path/filepath"
  "testing"
)

// TestResidentHeritageUpdateRebuildsChecker verifies resident generic heritage
// diagnostics across an incremental edit and an import-graph reconstruction.
//
// Changing an argument preserves the import graph; changing the imported
// declaration selects a different generic default and requires a full Program.
// Both updates must replace the standalone lint checker and discard stale rules.
//
// 1. Load an interface extending an imported string-default generic.
// 2. Change its explicit argument to number and assert incremental reuse.
// 3. Import a number-default generic and assert full reconstruction reports again.
//
// @evidence contracts/testing.md#behavioral-verification Actual program.applyChange must produce finding counts one, zero and one, return true only for the same-import edit and replace the checker in both updated generations.
// @evidence contracts/testing.md#independent-expectations Authored string and number defaults determine which explicit argument repeats a default; expected counts and reuse decisions follow those inputs independently of a second compiler run.
// @evidence contracts/testing.md#distinguishing-cases Same-import argument replacement exercises reuse; changed import exercises fallback reconstruction, with the same explicit number argument switching from distinct to default-equal.
// @evidence contracts/testing.md#execution-ownership This public Go unit loads Programs, invokes applyChange and runs the actual registered typed rule in process; temporary project files do not install a consumer, build a native artifact or start a host process.
func TestResidentHeritageUpdateRebuildsChecker(t *testing.T) {
  root := t.TempDir()
  main := filepath.Join(root, "main.ts")
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
    "compilerOptions":{"target":"ES2022","module":"commonjs","strict":true},
    "files":["main.ts"]
  }`)
  writeFile(t, filepath.Join(root, "string-default.ts"), "export interface Box<T = string> {}\n")
  writeFile(t, filepath.Join(root, "number-default.ts"), "export interface Box<T = number> {}\n")
  writeFile(t, main, "import { Box } from './string-default';\ninterface Result extends Box<string> {}\n")
  prog, diags, err := loadProgram(root, "tsconfig.json", loadProgramOptions{forceNoEmit: true, needsRuleChecker: true})
  if err != nil || len(diags) != 0 {
    t.Fatalf("load: err=%v diagnostics=%v", err, diags)
  }
  defer prog.close()
  engine := NewEngineWithResolver(InlineRuleResolver{Rules: RuleConfig{
    "typescript/no-unnecessary-type-arguments": SeverityError,
  }})
  if err := engine.ConfigError(); err != nil {
    t.Fatal(err)
  }
  engine.SetCurrentDirectory(root)
  if findings := prog.runLintCycle(engine); len(findings) != 1 {
    t.Fatalf("initial default repetition findings=%d, want 1", len(findings))
  }
  before := prog.checker
  writeFile(t, main, "import { Box } from './string-default';\ninterface Result extends Box<number> {}\n")
  if !prog.applyChange(main) {
    t.Fatal("same-import edit did not reuse the Program")
  }
  if prog.checker == nil || prog.checker == before {
    t.Fatal("incremental update retained the old checker")
  }
  if findings := prog.runLintCycle(engine); len(findings) != 0 {
    t.Fatalf("distinct argument findings=%d, want 0", len(findings))
  }
  before = prog.checker
  writeFile(t, main, "import { Box } from './number-default';\ninterface Result extends Box<number> {}\n")
  if prog.applyChange(main) {
    t.Fatal("changed import incorrectly reported incremental reuse")
  }
  if prog.checker == nil || prog.checker == before {
    t.Fatal("full reconstruction retained the old checker")
  }
  if findings := prog.runLintCycle(engine); len(findings) != 1 {
    t.Fatalf("new imported default repetition findings=%d, want 1", len(findings))
  }
}
