package evidence

import (
  "encoding/json"
  "os"
  "path/filepath"
  "testing"
  "github.com/samchon/ttsc/packages/lint/rule"
)

/**
 * Verifies a rooted TypeScript reference reads a sibling outside the Program.
 *
 * No source imports this implementation and the target has no evidence tags.
 * Its edits, deletion, and restoration must change fresh graph evaluations.
 *
 * 1. Create a Markdown-only project and a sibling code population.
 * 2. Resolve its file link through root/files with an empty Program.
 * 3. Delete and restore the target and assert failure then recovery.
 *
 * @evidence contracts/testing.md#behavioral-verification With a docs project holding review.md and a sibling ../api/example.ts, graphRule.Check over an empty Program and a TypeScript reference with root `../api` must give no diagnostics; after the target is made `export const value = ;` it must report `TypeScript syntax error`, after the target is deleted `Missing TypeScript evidence file`, and after it is restored no diagnostics.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the root contract: an explicit root authorizes a sibling that no Program source imports, and edits, deletion and restoration of that file must be reflected by fresh graph runs.
 * @evidence contracts/testing.md#distinguishing-cases One file moved through valid, malformed, absent and restored states within one test; each state has its own literal expectation, and the reporter is rebuilt on each check.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksLoadExplicitExternalRoots is a Go unit entry in the native test process; local write and check closures create real temp files and call graphRule.Check directly with an empty Program, with no consumer install or product host.
 */
func TestFileLinksLoadExplicitExternalRoots(t *testing.T) {
  workspace := t.TempDir()
  root, sibling := filepath.Join(workspace, "docs"), filepath.Join(workspace, "api")
  for _, directory := range []string{root, sibling} {
    if err := os.MkdirAll(directory, 0755); err != nil {
      t.Fatal(err)
    }
  }
  write := func(file, content string) {
    t.Helper()
    if err := os.WriteFile(file, []byte(content), 0644); err != nil {
      t.Fatal(err)
    }
  }
  write(filepath.Join(root, "review.md"), "## Review\n<!-- @link ../api/example.ts#Target.property Checks the implementation. -->\n")
  target := filepath.Join(sibling, "example.ts")
  write(target, `export class Target { static property = 1; }`)
  config := json.RawMessage(`{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"../api","files":["*.ts"],"symbol":"property"}}]}`)
  check := func() []string {
    reporter := &capturedProjectReporter{}
    graphRule{}.Check(rule.NewProjectContext(rule.ProjectIdentity{PhysicalProjectRoot: root}, nil, nil, rule.SeverityError, config, reporter))
    return reporter.messages
  }
  assertNoProblems(t, check())
  write(target, `export const value = ;`)
  assertProblemContains(t, check(), "TypeScript syntax error")
  write(target, `export class Target { static property = 1; }`)
  if err := os.Remove(target); err != nil {
    t.Fatal(err)
  }
  assertProblemContains(t, check(), "Missing TypeScript evidence file")
  write(target, `export class Target { static property = 2; }`)
  assertNoProblems(t, check())
}
