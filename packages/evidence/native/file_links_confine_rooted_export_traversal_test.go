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
 * 2. Assert the boundary failure without derivative missing coverage.
 * 3. Move its implementation into the root and verify recovery.
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
