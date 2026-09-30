package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies cardinality derives nothing from an empty healthy reference.
 *
 * A successfully loaded document can contain no selected unit, and the
 * materializer reports that population as empty on its own. Judging hosts on
 * top of it added one message per host asking each to cite a unit that does not
 * exist, which is the derived finding the loader-failure path already refuses.
 * The count of zero is true; the demand it produced was not answerable.
 *
 *  1. Select one TypeScript function and a Markdown document with no heading.
 *  2. Require exactly one Markdown unit per selected symbol.
 *  3. Assert the population is named once and no host is named at all.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies cardinality derives nothing from an empty healthy reference. The original assertions check assert the population is named once and no host is named at all.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A successfully loaded document can contain no selected unit, and the materializer reports that population as empty on its own. Judging hosts on top of it added one message per host asking each to cite a unit that does not exist, which is the derived finding the loader-failure path already refuses. The count of zero is true; the demand it produced was not answerable. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Select one TypeScript function and a Markdown document with no heading. Require exactly one Markdown unit per selected symbol. Assert the population is named once and no host is named at all. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSingleEvidencePerSymbolDerivesNothingFromAHealthyEmptyReference is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestSingleEvidencePerSymbolDerivesNothingFromAHealthyEmptyReference(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "Plain prose with no selected heading.\n",
    "src/test.ts":  "export function testContract(): void {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":"h2",
      "singleEvidencePerSymbol":true
    }
  }]}`)
  assertProblemContains(t, messages, "found no selected evidence units")
  if countProblemsContaining(messages, "singleEvidencePerSymbol requires exactly 1") != 0 {
    t.Fatalf(
      "an empty population must not be re-reported per host:\n%s",
      strings.Join(problemMessages(messages), "\n"),
    )
  }
}
