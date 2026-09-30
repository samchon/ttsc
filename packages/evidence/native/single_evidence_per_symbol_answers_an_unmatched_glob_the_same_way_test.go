package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies an empty reference answers the same way whether or not a file matched.
 *
 * The removed exception was conditional on the reference having matched at
 * least one path, so the identical empty population produced per-host findings
 * or none depending on a fact the question does not turn on. This is the other
 * half of that pair: same policy, same zero units, no matched file.
 *
 *  1. Point the same policy at a glob no document occupies.
 *  2. Evaluate.
 *  3. Assert the population is named and no host is named.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies an empty reference answers the same way whether or not a file matched. The original assertions check assert the population is named and no host is named.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The removed exception was conditional on the reference having matched at least one path, so the identical empty population produced per-host findings or none depending on a fact the question does not turn on. This is the other half of that pair: same policy, same zero units, no matched file. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Point the same policy at a glob no document occupies. Evaluate. Assert the population is named and no host is named. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSingleEvidencePerSymbolAnswersAnUnmatchedGlobTheSameWay is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestSingleEvidencePerSymbolAnswersAnUnmatchedGlobTheSameWay(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Discounts {#discounts}\n",
    "src/test.ts":  "export function testContract(): void {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/absent.md"],
      "symbol":"h2",
      "singleEvidencePerSymbol":true
    }
  }]}`)
  assertProblemContains(t, messages, "matched no markdown files")
  if countProblemsContaining(messages, "singleEvidencePerSymbol requires exactly 1") != 0 {
    t.Fatalf(
      "an unmatched glob must not be re-reported per host:\n%s",
      strings.Join(problemMessages(messages), "\n"),
    )
  }
}
