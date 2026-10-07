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
 *
 * @evidence contracts/testing.md#behavioral-verification Nine t.Run rows link targets in a docs/review.md against a property reference over src/example.ts (a class with a public field, a private field and an accessor, plus a function) and src/other.ts, and each must contain its own cause diagnostic (`Malformed file-qualified` for a missing fragment and for a trailing dot, `Missing TypeScript evidence file`, `Missing TypeScript evidence export`, `Missing TypeScript evidence member`, `private or protected`, `accessors are not evidence units`, `Unselected TypeScript evidence target` and `Out-of-population TypeScript evidence target`) together with `Missing acknowledgement`.
 * @evidence contracts/testing.md#independent-expectations The expected cause per row is an authored table from the resolution contract: each kind of failed link has its own repair message and none of them acknowledges the real property, which stays owed.
 * @evidence contracts/testing.md#distinguishing-cases Each failure class is its own named row against the same population, so a resolver that collapsed two causes into one message would fail the row of the other; only containment of the two fragments is asserted.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksReportResolutionCauses is a Go unit entry in the native test process that owns nine t.Run rows; runIndexRule writes each fixture to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
