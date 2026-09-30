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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a host carrying no tag owes the whole checklist. The original assertions check assert one diagnostic names the host and both unanswered items.
 * @evidence contracts/testing.md#independent-expectations Counting only the hosts that wrote something would let a file join the claim and answer nothing, which is the silent hole the per-host denominator exists to close. The report must also stay one diagnostic naming both items rather than one per pair. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Select a function with no documentation comment beside a two-item checklist. Run the graph. Assert one diagnostic names the host and both unanswered items. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestChecklistCountsASilentHostAsOwingEveryItem is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
