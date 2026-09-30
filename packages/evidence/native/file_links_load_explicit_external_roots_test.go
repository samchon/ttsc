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
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check through the file-link fixture exercises this case. Verifies a rooted TypeScript reference reads a sibling outside the Program.
 *
 * @evidence contracts/testing.md#independent-expectations An explicit ../api root authorizes a Program-absent sibling; malformed source, deletion, and restoration independently require syntax error, missing file, and clean recovery.
 *
 * @evidence contracts/testing.md#distinguishing-cases Create a Markdown-only project and a sibling code population. Resolve its file link through root/files with an empty Program. Delete and restore the target and assert failure then recovery.
 *
 * @evidence contracts/testing.md#execution-ownership TestFileLinksLoadExplicitExternalRoots is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the file-link fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
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
