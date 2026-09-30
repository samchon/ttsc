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
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check through the authored project-rule fixture exercises this case. Verifies file-link reviews expire on code changes while examples stay inert.
 *
 * @evidence contracts/testing.md#independent-expectations A valid review must cover unchanged source and expire after value changes from 1 to 2. Its suggested fingerprint is obtained from the rule, so this checks lifecycle and does not independently certify the hash algorithm.
 *
 * @evidence contracts/testing.md#distinguishing-cases Cite one property and obtain the required content fingerprint. Review it beside a fenced invalid link and verify success. Change its implementation and verify the review expires.
 *
 * @evidence contracts/testing.md#execution-ownership TestFileLinksPreserveReviewsAndFences is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the authored project-rule fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
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
