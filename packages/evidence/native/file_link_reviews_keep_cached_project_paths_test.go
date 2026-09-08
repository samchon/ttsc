package evidence

import (
  "encoding/json"
  "os"
  "path/filepath"
  "regexp"
  "strings"
  "testing"
)

/**
 * Verifies cached snapshots retain the paths of their current project context.
 *
 * A shared Source pointer can keep its declaration ID across root aliases while
 * its relative path changes. An old path must not redirect review metadata.
 *
 * 1. Require a review of one snapshot through physical and linked project roots.
 * 2. Keep requiring that review after the saved source is removed.
 * 3. Accept its fingerprint and expire it when the editor snapshot changes.
 */
func TestFileLinkReviewsKeepCachedProjectPaths(t *testing.T) {
  fixture := newFileLinkFixture(t, map[string]string{
    "physical/project/review.md": "## Review\n<!-- @link ../api/value.ts#value Reads the value. -->\n",
    "physical/api/value.ts":      "export const value = 1;",
    "logical/api/value.ts":       "export const decoy = 2;",
  }, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"../api","files":["value.ts"],"symbol":"property","requireReview":true}}]}`)
  workspace := fixture.root
  for link, target := range map[string]string{"logical/project": "physical/project", "logical/api-link": "physical/api"} {
    if err := linkDirectory(filepath.Join(workspace, target), filepath.Join(workspace, link)); err != nil {
      t.Fatal(err)
    }
  }
  fixture.sources = append(fixture.sources, fixture.source("physical/api/value.ts", "export const value = 1;"))
  edited := fixture.source("physical/api/value.ts", "export const value = 2;")
  fixture.root = filepath.Join(workspace, "physical/project")
  messages := fixture.check()
  assertProblemContains(t, messages, "Unreviewed @evidence")
  match := regexp.MustCompile(` #([0-9a-f]{7}) `).FindStringSubmatch(strings.Join(messages, "\n"))
  if len(match) != 2 {
    t.Fatalf("expected the declaration's fingerprint: %v", messages)
  }
  fixture.root = filepath.Join(workspace, "logical/project")
  fixture.options = json.RawMessage(`{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"../api-link","files":["value.ts"],"symbol":"property","requireReview":true}}]}`)
  content := "## Review\n<!-- @link ../api-link/value.ts#value Reads the value. -->\n"
  fixture.write("review.md", content)
  assertProblemContains(t, fixture.check(), "Unreviewed @evidence")
  if err := os.Remove(filepath.Join(workspace, "physical/api/value.ts")); err != nil {
    t.Fatal(err)
  }
  assertProblemContains(t, fixture.check(), "Unreviewed @evidence")
  fixture.write("review.md", content+"<!-- @evidenceReview ../api-link/value.ts#value #"+match[1]+" Checked the initializer. -->\n")
  assertNoProblems(t, fixture.check())
  fixture.sources[0] = edited
  assertProblemContains(t, fixture.check(), "Stale @evidenceReview")
}
