package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies single-evidence cardinality uses distinct units and includes silent hosts.
 *
 * Counting tags would let duplicate citations inflate one host and would never see a selected function with no JSDoc. The policy instead starts from every semantic claim unit and projects distinct covered reference-unit identities onto it.
 *
 *  1. Select an empty host, a duplicate-tag host, and a two-unit host.
 *  2. Require exactly one positive unit per semantic host.
 *  3. Assert only the zero-unit and two-unit hosts fail cardinality.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule selects empty, duplicate and broad functions; exactly two cardinality failures must name counts zero and two, omit the duplicate host, and retain Duplicate evidence.
 * @evidence contracts/testing.md#independent-expectations Cardinality counts distinct selected unit identities per semantic host, including hosts without tags; duplicate tags do not add units.
 * @evidence contracts/testing.md#distinguishing-cases Zero tags, repeated one-unit tags and two-unit coverage challenge both host discovery and tag-based counting in one graph.
 * @evidence contracts/testing.md#execution-ownership TestSingleEvidencePerSymbolCountsDistinctUnitsAndZeroTagHosts is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestSingleEvidencePerSymbolCountsDistinctUnitsAndZeroTagHosts(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## First {#first}\n\n## Second {#second}\n",
    "src/tests.ts": `export function empty(): void {}

/**
 * @evidence docs/spec.md#first First proof.
 * @evidence docs/spec.md#first Repeated proof.
 */
export function duplicate(): void {}

/**
 * @evidence docs/spec.md#first First proof.
 * @evidence docs/spec.md#second Second proof.
 */
export function broad(): void {}
`,
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
  if count := countProblemsContaining(messages, "singleEvidencePerSymbol requires exactly 1"); count != 2 {
    t.Fatalf("expected zero and broad hosts to fail cardinality, got %d:\n%s", count, strings.Join(problemMessages(messages), "\n"))
  }
  assertProblemContains(t, messages, "TypeScript function 'empty'")
  assertProblemContains(t, messages, "cites 0 distinct selected evidence unit(s)")
  assertProblemContains(t, messages, "TypeScript function 'broad'")
  assertProblemContains(t, messages, "cites 2 distinct selected evidence unit(s)")
  if strings.Contains(strings.Join(problemMessages(messages), "\n"), "TypeScript function 'duplicate'") {
    t.Fatalf("duplicate tags inflated the semantic host count:\n%s", strings.Join(problemMessages(messages), "\n"))
  }
  assertProblemContains(t, messages, "Duplicate @evidence")
}
