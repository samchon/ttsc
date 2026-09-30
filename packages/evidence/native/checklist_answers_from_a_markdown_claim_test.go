package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a Markdown claim answers a checklist the way a TypeScript claim does.
 *
 * The option is confined to the Markdown reference, never to the claim, and the case it was asked for is a document set answering a rules document. A claim-kind dependency would leave that shape working only for code, and the file-level host is the granularity that makes the document side usable at all.
 *
 *  1. Select whole plan documents as hosts and a two-item rules document as the checklist.
 *  2. Answer both items in one plan and nothing in the other.
 *  3. Assert the answering plan passes and the silent plan owes both items.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a Markdown claim answers a checklist the way a TypeScript claim does. The original assertions check assert the answering plan passes and the silent plan owes both items.
 * @evidence contracts/testing.md#independent-expectations The option is confined to the Markdown reference, never to the claim, and the case it was asked for is a document set answering a rules document. A claim-kind dependency would leave that shape working only for code, and the file-level host is the granularity that makes the document side usable at all. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Select whole plan documents as hosts and a two-item rules document as the checklist. Answer both items in one plan and nothing in the other. Assert the answering plan passes and the silent plan owes both items. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestChecklistAnswersFromAMarkdownClaim is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestChecklistAnswersFromAMarkdownClaim(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/rules.md": checklistDocument,
    "plans/alpha.md": `<!-- @evidence docs/rules.md#no-hardcoding The plan keeps the general path. -->
<!-- @evidence docs/rules.md#no-whack-a-mole The plan seals the class. -->

Alpha plan prose.
`,
    "plans/gamma.md": `<!-- @evidence docs/rules.md#no-hardcoding The plan keeps the general path. -->

Gamma plan prose.
`,
    "plans/beta.md": "Beta plan prose with no acknowledgement.\n",
  }, `{"claims":[{
    "type":"markdown",
    "files":["plans/**"],
    "symbol":"file",
    "reference":{
      "type":"markdown",
      "files":["docs/rules.md"],
      "symbol":"h2",
      "checklist":true
    }
  }]}`)
  if count := countProblemsContaining(messages, "checklist item(s)"); count != 2 {
    t.Fatalf("expected the partial and the silent plan to be reported, got %d:\n%s", count, strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "Evidence host Markdown file at plans/beta.md")
  assertProblemContains(t, messages, "has not acknowledged 2 of 2 checklist item(s): 'docs/rules.md#no-hardcoding', 'docs/rules.md#no-whack-a-mole'")
  assertProblemContains(t, messages, "Evidence host Markdown file at plans/gamma.md")
  assertProblemContains(t, messages, "has not acknowledged 1 of 2 checklist item(s): 'docs/rules.md#no-whack-a-mole'")
  // Without the partial plan and this guard, a regression discharging a host on
  // its first acknowledgement would leave the counts unchanged.
  if strings.Contains(strings.Join(messages, "\n"), "plans/alpha.md") {
    t.Fatalf("a plan that answered every item was reported:\n%s", strings.Join(messages, "\n"))
  }
}
