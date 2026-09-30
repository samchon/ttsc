package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies exclusions remain one reviewed decision per covered scope.
 *
 * Repeating an exclusion makes ownership of its reason ambiguous regardless of
 * host or declaration order. Ancestor and descendant exclusions duplicate the
 * selected unit where their scopes intersect.
 *
 *  1. Repeat an exact exclusion on one and on separate hosts.
 *  2. Overlap parent and child exclusions in both source orders.
 *  3. Assert each later exclusion produces one duplicate finding.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies exclusions remain one reviewed decision per covered scope. The original assertions check assert each later exclusion produces one duplicate finding.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Repeating an exclusion makes ownership of its reason ambiguous regardless of host or declaration order. Ancestor and descendant exclusions duplicate the selected unit where their scopes intersect. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Repeat an exact exclusion on one and on separate hosts. Overlap parent and child exclusions in both source orders. Assert each later exclusion produces one duplicate finding. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestOverlappingExclusionsAreRejectedAcrossHostsAndHierarchy is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestOverlappingExclusionsAreRejectedAcrossHostsAndHierarchy(t *testing.T) {
  cases := map[string]string{
    "same target on one host": `/**
 * @evidenceExclude docs/spec.md#contract The claim does not own this contract.
 * @evidenceExclude docs/spec.md#contract The claim repeats the exclusion.
 */
export function first(): void {}
`,
    "same target across hosts": `/** @evidenceExclude docs/spec.md#contract The adapter does not own this contract. */
export function first(): void {}
/** @evidenceExclude docs/spec.md#contract The service does not own this contract. */
export function second(): void {}
`,
    "parent before child": `/** @evidenceExclude docs/spec.md#contract This layer excludes the contract family. */
export function first(): void {}
/** @evidenceExclude docs/spec.md#validation This layer also excludes validation. */
export function second(): void {}
`,
    "child before parent": `/** @evidenceExclude docs/spec.md#validation This layer excludes validation. */
export function first(): void {}
/** @evidenceExclude docs/spec.md#contract This layer also excludes the contract family. */
export function second(): void {}
`,
  }
  for name, source := range cases {
    t.Run(name, func(t *testing.T) {
      messages := runIndexRule(t, map[string]string{
        "docs/spec.md": "## Contract {#contract}\n### Validation {#validation}\n",
        "src/claim.ts": source,
      }, acknowledgementIntentConfig)
      if got := countProblemsContaining(messages, "Duplicate @evidenceExclude"); got != 1 {
        t.Fatalf("overlapping exclusions produced %d findings:\n%s", got, strings.Join(messages, "\n"))
      }
      if countProblemsContaining(messages, "Conflicting acknowledgements") != 0 {
        t.Fatalf("same-intent exclusions became a conflict:\n%s", strings.Join(messages, "\n"))
      }
      assertProblemContains(t, messages, "in Claim 1 ('contracts') reference 1")
      if countProblemsContaining(messages, "Missing acknowledgement") != 0 {
        t.Fatalf("the duplicate exclusion stopped covering its target:\n%s", strings.Join(messages, "\n"))
      }
    })
  }
}
