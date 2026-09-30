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
 *  3. Assert the empty population is named and no per-host cardinality is derived.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule loads a prose-only Markdown document for a live function; the no-selected-units finding must appear without per-host cardinality.
 * @evidence contracts/testing.md#independent-expectations No selected units leaves no answerable per-host citation demand, even though the document loaded successfully.
 * @evidence contracts/testing.md#distinguishing-cases A matched headingless file distinguishes healthy emptiness from an unmatched glob or loader failure; the total population finding count is not asserted.
 * @evidence contracts/testing.md#execution-ownership TestSingleEvidencePerSymbolDerivesNothingFromAHealthyEmptyReference is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
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
