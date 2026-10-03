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
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule over a function checklist with a `complete` host citing both items and a `partial` host citing only `no-hardcoding`; exactly one `checklist item(s)` diagnostic must appear, naming `TypeScript function 'partial'` and `has not acknowledged 1 of 2 checklist item(s): 'docs/rules.md#no-whack-a-mole'`, and none naming `'complete'`.
 * @evidence contracts/testing.md#independent-expectations The expected single report is authored from the checklist contract that every host is judged against the whole item population, so a thorough host does not answer for another host.
 * @evidence contracts/testing.md#distinguishing-cases One complete and one partial host in the same claim: an ordinary once-per-reference coverage would pass both, and a checklist that reported every host would also report `complete`.
 * @evidence contracts/testing.md#execution-ownership TestChecklistOwesEveryItemFromEveryHost is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
