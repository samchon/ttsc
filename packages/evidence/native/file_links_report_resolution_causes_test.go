package evidence

import "testing"

/**
 * Verifies file-link failures name their repair and never satisfy coverage.
 *
 * A failed citation is not an acknowledgement, and a member withheld by the
 * collector must be distinguished from a misspelled export or file.
 *
 * 1. Cite malformed, missing, unselected, and inaccessible targets.
 * 2. Evaluate each against the same public class population.
 * 3. Assert its diagnostic and the still-missing acknowledgement.
 */
func TestFileLinksReportResolutionCauses(t *testing.T) {
  for _, test := range []struct{ target, diagnostic string }{
    {"../src/example.ts", "Malformed file-qualified"},
    {"../src/example.ts#Target.", "Malformed file-qualified"},
    {"../src/missing.ts#Target", "Missing TypeScript evidence file"},
    {"../src/example.ts#Absent", "Missing TypeScript evidence export"},
    {"../src/example.ts#Target.prototype.absent", "Missing TypeScript evidence member"},
    {"../src/example.ts#Target.prototype.secret", "private or protected"},
    {"../src/example.ts#Target.prototype.access", "accessors are not evidence units"},
    {"../src/example.ts#call", "Unselected TypeScript evidence target"},
    {"../src/other.ts#Target", "Out-of-population TypeScript evidence target"},
  } {
    t.Run(test.target, func(t *testing.T) {
      messages := runIndexRule(t, map[string]string{
        "src/example.ts": `export class Target { value = 1; private secret = 2; get access() { return 1; } } export function call(): void {}`,
        "src/other.ts":   `export class Target { value = 1; }`,
        "docs/review.md": "## Review\n<!-- @link " + test.target + " Reviews this target. -->\n",
      }, `{"claims":[{"type":"markdown","files":["docs/review.md"],"symbol":"h2","reference":{"type":"typescript","files":["src/example.ts"],"symbol":"property"}}]}`)
      assertProblemContains(t, messages, test.diagnostic)
      assertProblemContains(t, messages, "Missing acknowledgement")
    })
  }
}
