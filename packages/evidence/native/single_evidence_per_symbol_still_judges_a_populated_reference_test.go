package evidence

import "testing"

/**
 * Verifies cardinality still judges a host against a population that has units.
 *
 * This is the negative twin of the two cases above and the reason the early
 * return is bounded by emptiness rather than by policy. A host that cites none
 * of a population that really holds units is the failure singleEvidencePerSymbol
 * exists to catch, and the suppression must not reach it.
 *
 *  1. Select one TypeScript function and a document with two headings.
 *  2. Require exactly one Markdown unit per selected symbol, and cite neither.
 *  3. Assert the host is named with its zero count.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies cardinality still judges a host against a population that has units. The original assertions check assert the host is named with its zero count.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations This is the negative twin of the two cases above and the reason the early return is bounded by emptiness rather than by policy. A host that cites none of a population that really holds units is the failure singleEvidencePerSymbol exists to catch, and the suppression must not reach it. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Select one TypeScript function and a document with two headings. Require exactly one Markdown unit per selected symbol, and cite neither. Assert the host is named with its zero count. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSingleEvidencePerSymbolStillJudgesAPopulatedReference is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
