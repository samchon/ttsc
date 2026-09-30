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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert only the untagged one is reported as missing.
 * @evidence contracts/testing.md#independent-expectations This is the obligation half of the issue: the population a reference selects must not contain something the source already declared is not API, or the author's only answers are a false citation or an exclusion whose reason restates the tag. The untagged operation beside it stays owed, so the case cannot pass by selecting nothing. The authored scenario requires this outcome: Assert only the untagged one is reported as missing.
 * @evidence contracts/testing.md#distinguishing-cases Publish one tagged and one untagged callable through an entry. Cite neither. Assert only the untagged one is reported as missing.
 * @evidence contracts/testing.md#execution-ownership TestGraphOwesNoAcknowledgementForHiddenReferenceUnits runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
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
