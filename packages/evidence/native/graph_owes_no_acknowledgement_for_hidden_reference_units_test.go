package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a withdrawn declaration owes no acknowledgement as a reference unit.
 *
 * This is the obligation half of the issue: the population a reference selects
 * must not contain something the source already declared is not API, or the
 * author's only answers are a false citation or an exclusion whose reason
 * restates the tag. The untagged operation beside it stays owed, so the case
 * cannot pass by selecting nothing.
 *
 *  1. Publish one tagged and one untagged callable through an entry.
 *  2. Cite neither.
 *  3. Assert only the untagged one is reported as missing.
 *
 * @evidence contracts/testing.md#behavioral-verification For each of `@internal`, `@hidden` and `@ignore` a t.Run subtest runs the graph rule with a function claim over test/** and a function reference over src/index.ts, where `reset` carries the tag and `check` does not and nothing is cited; the diagnostics must contain `Missing acknowledgement for 'check'` and exactly one `Missing acknowledgement`.
 * @evidence contracts/testing.md#independent-expectations The expected single report is authored from the withdrawal contract: a declaration the source already marks as not API must not be in the reference population, so only the untagged `check` is owed.
 * @evidence contracts/testing.md#distinguishing-cases Three withdrawal tag spellings are separate subtests; the untagged sibling keeps the claim active and owed, so the case cannot pass by selecting nothing, and the count of one fails if `reset` is also owed.
 * @evidence contracts/testing.md#execution-ownership TestGraphOwesNoAcknowledgementForHiddenReferenceUnits is a Go unit entry in the native test process that owns three t.Run subtests over hiddenTagCases; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestGraphOwesNoAcknowledgementForHiddenReferenceUnits(t *testing.T) {
  for _, tag := range hiddenTagCases {
    t.Run(tag, func(t *testing.T) {
      messages := runIndexRule(t, map[string]string{
        "src/api/health.ts": `
/** ` + tag + ` Internal plumbing. */
export function reset(): void {}

export function check(): void {}
`,
        "src/index.ts":   "export * from \"./api/health\";\n",
        "test/health.ts": "export function test_health(): void {}\n",
      }, `{"claims":[{
        "type":"typescript",
        "files":["test/**"],
        "symbol":"function",
        "reference":{"type":"typescript","files":["src/index.ts"],"symbol":["function"]}
      }]}`)
      assertProblemContains(t, messages, "Missing acknowledgement for 'check'")
      if count := countProblemsContaining(messages, "Missing acknowledgement"); count != 1 {
        t.Fatalf(
          "expected only the untagged operation to be owed, got %d:\n%s",
          count,
          strings.Join(messages, "\n"),
        )
      }
    })
  }
}
