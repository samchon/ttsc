package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a checklist constrains only the reference that declares it.
 *
 * Reference-local strengthening is the contract every policy option shares, and a checklist changes more machinery than the others — coverage, aggregates, and the duplicate keys. An ordinary twin over the same document must therefore stay satisfied by one host while the checklist reports the other.
 *
 *  1. Configure an ordinary and a checklist reference over one document.
 *  2. Answer every item from one host only.
 *  3. Assert the ordinary reference is silent and only the checklist reference reports the other host.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a checklist constrains only the reference that declares it. The original assertions check assert the ordinary reference is silent and only the checklist reference reports the other host.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Reference-local strengthening is the contract every policy option shares, and a checklist changes more machinery than the others — coverage, aggregates, and the duplicate keys. An ordinary twin over the same document must therefore stay satisfied by one host while the checklist reports the other. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Configure an ordinary and a checklist reference over one document. Answer every item from one host only. Assert the ordinary reference is silent and only the checklist reference reports the other host. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestChecklistStaysLocalToItsOwnReference is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestChecklistStaysLocalToItsOwnReference(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/rules.md": checklistDocument,
    "src/complete.ts": `/**
 * @evidence docs/rules.md#no-hardcoding The general logic decides.
 * @evidence docs/rules.md#no-whack-a-mole Every sibling case is covered.
 */
export function complete(): void {}
`,
    "src/quiet.ts": "export function quiet(): void {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":[
      {
        "type":"markdown",
        "files":["docs/rules.md"],
        "symbol":"h2"
      },
      {
        "type":"markdown",
        "files":["docs/rules.md"],
        "symbol":"h2",
        "checklist":true
      }
    ]
  }]}`)
  if count := countProblemsContaining(messages, "checklist item(s)"); count != 1 {
    t.Fatalf("expected exactly one checklist diagnostic, got %d:\n%s", count, strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "Claim 1 reference 2")
  assertProblemContains(t, messages, "TypeScript function 'quiet'")
  if strings.Contains(strings.Join(messages, "\n"), "Missing acknowledgement") {
    t.Fatalf("the ordinary reference lost its own coverage answer:\n%s", strings.Join(messages, "\n"))
  }
}
