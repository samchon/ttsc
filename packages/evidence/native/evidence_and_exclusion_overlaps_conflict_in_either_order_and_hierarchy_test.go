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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies opposite acknowledgement intents conflict independent of source order and hierarchy direction. The original assertions check assert every arrangement produces exactly one conflict.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Evidence says a claim uses a selected unit; exclusion says the same claim does not. Exact and ancestor-descendant overlaps are contradictions whichever declaration appears first and whichever intent owns the broader scope. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Reverse exact evidence and exclusion order. Reverse order for both parent-evidence and parent-exclusion overlaps. Assert every arrangement produces exactly one conflict. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestEvidenceAndExclusionOverlapsConflictInEitherOrderAndHierarchy is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
