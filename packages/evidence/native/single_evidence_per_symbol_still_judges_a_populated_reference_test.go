package evidence

import "testing"

/**
 * Verifies cardinality still judges a host against a population that has units.
 *
 * This is the negative twin of the empty-reference regressions and the reason the early
 * return is bounded by emptiness rather than by policy. A host that cites none
 * of a population that really holds units is the failure singleEvidencePerSymbol
 * exists to catch, and the suppression must not reach it.
 *
 *  1. Select one TypeScript function and a document with two headings.
 *  2. Require exactly one Markdown unit per selected symbol, and cite neither.
 *  3. Assert the host is named with its zero count.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule selects a function citing neither of two H2s; its named zero-unit cardinality finding must appear.
 * @evidence contracts/testing.md#independent-expectations Suppression for empty references must not suppress a live host's zero coverage when units exist.
 * @evidence contracts/testing.md#distinguishing-cases Two real headings keep the denominator populated; presence is checked without requiring total diagnostic count or every missing target.
 * @evidence contracts/testing.md#execution-ownership TestSingleEvidencePerSymbolStillJudgesAPopulatedReference is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestSingleEvidencePerSymbolStillJudgesAPopulatedReference(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Discounts {#discounts}\n\n## Coupons {#coupons}\n",
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
  assertProblemContains(t, messages, "TypeScript function 'testContract'")
  assertProblemContains(t, messages, "cites 0 distinct selected evidence unit(s); singleEvidencePerSymbol requires exactly 1")
}
