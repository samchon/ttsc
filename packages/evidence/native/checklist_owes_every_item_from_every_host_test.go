package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a checklist owes every item from every selected host.
 *
 * Ordinary coverage is satisfied once per reference, so a thorough host answers for every other host in the claim and a host that answered nothing is invisible. The checklist reference must instead judge each host against the whole population and report only the hosts that fell short.
 *
 *  1. Select two functions and a two-item Markdown checklist.
 *  2. Cite both items from one host and only the first from the other.
 *  3. Assert the complete host passes and the partial host is reported with just its missing item.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a checklist owes every item from every selected host. The original assertions check assert the complete host passes and the partial host is reported with just its missing item.
 * @evidence contracts/testing.md#independent-expectations Ordinary coverage is satisfied once per reference, so a thorough host answers for every other host in the claim and a host that answered nothing is invisible. The checklist reference must instead judge each host against the whole population and report only the hosts that fell short. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Select two functions and a two-item Markdown checklist. Cite both items from one host and only the first from the other. Assert the complete host passes and the partial host is reported with just its missing item. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestChecklistOwesEveryItemFromEveryHost is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestChecklistOwesEveryItemFromEveryHost(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/rules.md": checklistDocument,
    "src/complete.ts": `/**
 * @evidence docs/rules.md#no-hardcoding The general logic decides.
 * @evidence docs/rules.md#no-whack-a-mole Every sibling case is covered.
 */
export function complete(): void {}
`,
    "src/partial.ts": `/** @evidence docs/rules.md#no-hardcoding The general logic decides. */
export function partial(): void {}
`,
  }, checklistConfig)
  if count := countProblemsContaining(messages, "checklist item(s)"); count != 1 {
    t.Fatalf("expected only the partial host to be reported, got %d:\n%s", count, strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "TypeScript function 'partial'")
  assertProblemContains(t, messages, "has not acknowledged 1 of 2 checklist item(s): 'docs/rules.md#no-whack-a-mole'")
  if strings.Contains(strings.Join(messages, "\n"), "'complete'") {
    t.Fatalf("a host that answered every item was reported:\n%s", strings.Join(messages, "\n"))
  }
}
