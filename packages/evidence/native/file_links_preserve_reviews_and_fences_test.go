package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies file-link reviews expire on code changes while examples stay inert.
 *
 * @link is an acknowledgement; its review remains an annotation and fenced
 * examples must neither create coverage nor demand reviews of example targets.
 *
 * 1. Cite one property and obtain the required content fingerprint.
 * 2. Review it beside a fenced invalid link and verify success.
 * 3. Change its implementation and verify the review expires.
 */
func TestFileLinksPreserveReviewsAndFences(t *testing.T) {
  files := map[string]string{
    "src/example.ts": "export const value = 1;\n",
    "docs/review.md": "## Review\n<!-- @link ../src/example.ts#value Checks the value. -->\n\n```md\n<!-- @link missing.ts#Never Example only. -->\n```\n",
  }
  config := `{"claims":[{"type":"markdown","files":["docs/review.md"],"symbol":"h2","reference":{"type":"typescript","files":["src/example.ts"],"symbol":"property","requireReview":true}}]}`
  messages := runIndexRule(t, files, config)
  fingerprint := ""
  for _, message := range messages {
    start := strings.Index(message, " #")
    if start >= 0 && len(message) >= start+9 {
      fingerprint = message[start+2 : start+9]
      break
    }
  }
  if fingerprint == "" {
    t.Fatalf("no expected fingerprint: %v", messages)
  }
  files["docs/review.md"] += "<!-- @evidenceReview ../src/example.ts#value #" + fingerprint + " Verified the initializer. -->\n"
  assertNoProblems(t, runIndexRule(t, files, config))
  files["src/example.ts"] = "export const value = 2;\n"
  assertProblemContains(t, runIndexRule(t, files, config), "Stale @evidenceReview")
}
