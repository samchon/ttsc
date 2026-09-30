package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies opposite acknowledgement intents conflict independent of source
 * order and hierarchy direction.
 *
 * Evidence says a claim uses a selected unit; exclusion says the same claim
 * does not. Exact and ancestor-descendant overlaps are contradictions whichever
 * declaration appears first and whichever intent owns the broader scope.
 *
 *  1. Reverse exact evidence and exclusion order.
 *  2. Reverse order for both parent-evidence and parent-exclusion overlaps.
 *  3. Assert every arrangement produces exactly one conflict.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule evaluates six source-order and parent/child intent permutations; each must report one conflict, both marker-location fragments, and no missing coverage.
 * @evidence contracts/testing.md#independent-expectations An evidence and exclusion scope sharing selected units contradict one another independently of order or which intent owns the parent.
 * @evidence contracts/testing.md#distinguishing-cases Exact overlap plus both hierarchy directions reject one-sided detection; missing-count zero verifies conflicting acknowledgements still contribute coverage.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceAndExclusionOverlapsConflictInEitherOrderAndHierarchy is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestEvidenceAndExclusionOverlapsConflictInEitherOrderAndHierarchy(t *testing.T) {
  cases := map[string]string{
    "exact evidence first": `/** @evidence docs/spec.md#contract Implements the contract. */
export function first(): void {}
/** @evidenceExclude docs/spec.md#contract The contract is excluded. */
export function second(): void {}
`,
    "exact exclusion first": `/** @evidenceExclude docs/spec.md#contract The contract is excluded. */
export function first(): void {}
/** @evidence docs/spec.md#contract Implements the contract. */
export function second(): void {}
`,
    "parent evidence first": `/** @evidence docs/spec.md#contract Implements the contract family. */
export function first(): void {}
/** @evidenceExclude docs/spec.md#validation Validation is excluded. */
export function second(): void {}
`,
    "parent evidence second": `/** @evidenceExclude docs/spec.md#validation Validation is excluded. */
export function first(): void {}
/** @evidence docs/spec.md#contract Implements the contract family. */
export function second(): void {}
`,
    "parent exclusion first": `/** @evidenceExclude docs/spec.md#contract The contract family is excluded. */
export function first(): void {}
/** @evidence docs/spec.md#validation Implements validation. */
export function second(): void {}
`,
    "parent exclusion second": `/** @evidence docs/spec.md#validation Implements validation. */
export function first(): void {}
/** @evidenceExclude docs/spec.md#contract The contract family is excluded. */
export function second(): void {}
`,
  }
  for name, source := range cases {
    t.Run(name, func(t *testing.T) {
      messages := runIndexRule(t, map[string]string{
        "docs/spec.md": "## Contract {#contract}\n### Validation {#validation}\n",
        "src/claim.ts": source,
      }, acknowledgementIntentConfig)
      if got := countProblemsContaining(messages, "Conflicting acknowledgements"); got != 1 {
        t.Fatalf("opposite intents produced %d conflicts:\n%s", got, strings.Join(messages, "\n"))
      }
      assertProblemContains(t, messages, "@evidence at ")
      assertProblemContains(t, messages, "overlaps @evidenceExclude at ")
      if countProblemsContaining(messages, "Missing acknowledgement") != 0 {
        t.Fatalf("the conflict stopped covering its target:\n%s", strings.Join(messages, "\n"))
      }
    })
  }
}
