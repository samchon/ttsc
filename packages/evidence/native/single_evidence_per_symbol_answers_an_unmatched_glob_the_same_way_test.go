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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule selects a live function but an absent Markdown file; matched-no-files must be present and per-host exactly-one cardinality must be absent.
 * @evidence contracts/testing.md#independent-expectations An empty reference owns its population diagnostic rather than asking each host to cite nonexistent units.
 * @evidence contracts/testing.md#distinguishing-cases An unmatched glob differs from a successfully loaded headingless document; this entry does not compare their complete messages directly.
 * @evidence contracts/testing.md#execution-ownership TestSingleEvidencePerSymbolAnswersAnUnmatchedGlobTheSameWay is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
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
