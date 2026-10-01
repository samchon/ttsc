package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies file-link reviews expire on code changes while examples stay inert.
 *
 * A file link is an acknowledgement; its review remains an annotation and fenced
 * examples must neither create coverage nor demand reviews of example targets.
 *
 * 1. Cite one property and obtain the required content fingerprint.
 * 2. Review it beside a fenced invalid link and verify success.
 * 3. Change its implementation and verify the review expires.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs a requireReview property reference over a review.md holding a `@link` to `src/example.ts#value` and a fenced example link to `missing.ts#Never`; the fingerprint the graph asks for is taken from its output and written as an `@evidenceReview`, which must give no diagnostics, and after the value changes from 1 to 2 the result must contain `Stale @evidenceReview`.
 * @evidence contracts/testing.md#independent-expectations The review lifecycle (valid, then stale after a content change) is authored from the review contract; the fingerprint is read from the rule's own message, so this checks acceptance and expiry rather than the hash algorithm.
 * @evidence contracts/testing.md#distinguishing-cases A fenced invalid link sits beside the real link: it must neither fail resolution nor demand a review of its target, and a value change must expire the accepted review.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksPreserveReviewsAndFences is a Go unit entry in the native test process; it calls the graph rule three times through runIndexRule over temp fixture files, with no consumer install or product host.
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
