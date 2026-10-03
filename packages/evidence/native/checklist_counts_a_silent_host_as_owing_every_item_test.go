package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a host carrying no tag owes the whole checklist.
 *
 * Counting only the hosts that wrote something would let a file join the claim and answer nothing, which is the silent hole the per-host denominator exists to close. The report must also stay one diagnostic naming both items rather than one per pair.
 *
 *  1. Select a function with no documentation comment beside a two-item checklist.
 *  2. Run the graph.
 *  3. Assert one diagnostic names the host and both unanswered items.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a function claim over `export function silent(): void {}` with no documentation against a two-item Markdown checklist; the test requires exactly one `checklist item(s)` diagnostic naming `TypeScript function 'silent'`, `has not acknowledged 2 of 2 checklist item(s)` with both item targets, and the repair sentence `Do what each item requires and cite it with @evidence on this host`.
 * @evidence contracts/testing.md#independent-expectations The expected text is authored from the checklist contract that a host that writes nothing still owes every item, in one diagnostic rather than one per host-item pair.
 * @evidence contracts/testing.md#distinguishing-cases A silent host with two items distinguishes a per-host denominator that counts only hosts that wrote a tag (no diagnostic) and a per-pair report (two diagnostics) from the required single report.
 * @evidence contracts/testing.md#execution-ownership TestChecklistCountsASilentHostAsOwingEveryItem is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestChecklistCountsASilentHostAsOwingEveryItem(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/rules.md": checklistDocument,
    "src/silent.ts": "export function silent(): void {}\n",
  }, checklistConfig)
  if count := countProblemsContaining(messages, "checklist item(s)"); count != 1 {
    t.Fatalf("expected exactly one host diagnostic, got %d:\n%s", count, strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "TypeScript function 'silent'")
  assertProblemContains(t, messages, "has not acknowledged 2 of 2 checklist item(s): 'docs/rules.md#no-hardcoding', 'docs/rules.md#no-whack-a-mole'")
  assertProblemContains(t, messages, "Do what each item requires and cite it with @evidence on this host")
}
