package evidence

import (
  "os"
  "path/filepath"
  "regexp"
  "strings"
  "testing"
)

/**
 * Verifies a project root alias cannot change an unchanged code review.
 *
 * Canonicalizing a file against an authored root leaks the checkout directory
 * into its ID when a junction, symlink, or Windows short name aliases the root.
 *
 * 1. Obtain a review fingerprint through the physical project directory.
 * 2. Apply it through linked/nested roots and a relocated project directory.
 * 3. Verify both accept it and an implementation edit still expires the review.
 */
func TestFileLinkFingerprintsIgnoreProjectRootAliases(t *testing.T) {
  workspace := t.TempDir()
  physical, linked := filepath.Join(workspace, "physical"), filepath.Join(workspace, "linked")
  if err := os.MkdirAll(physical, 0755); err != nil {
    t.Fatal(err)
  }
  if err := linkDirectory(physical, linked); err != nil {
    t.Fatal(err)
  }
  files := map[string]string{"api/value.ts": "export const value = 1;", "review.md": "## Review\n<!-- @link api/value.ts#value Reads the value. -->\n"}
  config := `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","files":["api/value.ts"],"symbol":"property","requireReview":true}}]}`
  messages := runIndexRuleAtRoot(t, physical, files, config)
  match := regexp.MustCompile(` #([0-9a-f]{7}) `).FindStringSubmatch(strings.Join(messages, "\n"))
  if len(match) != 2 {
    t.Fatalf("expected a review fingerprint: %v", messages)
  }
  files["review.md"] += "<!-- @evidenceReview api/value.ts#value #" + match[1] + " Checked the initializer. -->\n"
  assertNoProblems(t, runIndexRuleAtRoot(t, linked, files, config))
  assertNoProblems(t, runIndexRule(t, files, config))
  if err := linkDirectory(filepath.Join(linked, "api"), filepath.Join(physical, "forwarded")); err != nil {
    t.Fatal(err)
  }
  rooted := `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"forwarded","files":["value.ts"],"symbol":"property","requireReview":true}}]}`
  assertNoProblems(t, runIndexRuleAtRoot(t, linked, files, rooted))
  files["api/value.ts"] = "export const value = 2;"
  assertProblemContains(t, runIndexRuleAtRoot(t, linked, files, config), "Stale @evidenceReview")
}
