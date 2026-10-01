package evidence

import (
  "encoding/json"
  "os"
  "path/filepath"
  "testing"
  "github.com/samchon/ttsc/packages/lint/rule"
)

/**
 * Verifies rooted exports cannot silently escape into an unconfigured tree.
 *
 * A failed export makes the population incomplete. Reporting empty coverage
 * would hide that failure, while following it would cross the declared boundary.
 *
 * 1. Configure a disk barrel whose re-export leaves its root.
 * 2. Assert the explicit root-boundary failure.
 * 3. Move its implementation into the root and verify recovery.
 *
 * @evidence contracts/testing.md#behavioral-verification With a TypeScript reference rooted at `api`, graphRule.Check is run over temp files where api/index.ts re-exports `../private/value`, which must report `re-export leaves the explicitly configured root`; after api/index.ts is rewritten to re-export `./value` and api/value.ts is created, the check must report nothing.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the root contract: an explicit root authorizes `./value` but not `../private/value`, so the outside traversal must fail with the boundary reason and the repaired layout must pass.
 * @evidence contracts/testing.md#distinguishing-cases The same link before and after moving the implementation into the root; whether derivative diagnostics are suppressed after the boundary failure is not asserted.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksConfineRootedExportTraversal is a Go unit entry in the native test process; a local write closure creates the temp files and a check closure calls graphRule.Check directly, with no consumer install or product host.
 */
func TestFileLinksConfineRootedExportTraversal(t *testing.T) {
  root := t.TempDir()
  write := func(relative, content string) {
    t.Helper()
    file := filepath.Join(root, relative)
    if err := os.MkdirAll(filepath.Dir(file), 0755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(file, []byte(content), 0644); err != nil {
      t.Fatal(err)
    }
  }
  write("review.md", "## Review\n<!-- @link api/index.ts#value Reviews the value. -->\n")
  write("api/index.ts", "export { value } from '../private/value';\n")
  write("private/value.ts", "export const value = 1;\n")
  options := json.RawMessage(`{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"api","files":["index.ts"],"symbol":"property"}}]}`)
  check := func() []string {
    reporter := &capturedProjectReporter{}
    graphRule{}.Check(rule.NewProjectContext(rule.ProjectIdentity{PhysicalProjectRoot: root}, nil, nil, rule.SeverityError, options, reporter))
    return reporter.messages
  }
  assertProblemContains(t, check(), "re-export leaves the explicitly configured root")
  write("api/index.ts", "export { value } from './value';\n")
  write("api/value.ts", "export const value = 1;\n")
  assertNoProblems(t, check())
}
