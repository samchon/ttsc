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
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with one function claim carrying an ordinary and a checklist Markdown reference over the same document, with a `complete` host citing both items and a `quiet` undocumented host; the test requires exactly one `checklist item(s)` diagnostic, mentioning `Claim 1 reference 2` and `TypeScript function 'quiet'`, and no `Missing acknowledgement` message.
 * @evidence contracts/testing.md#independent-expectations The expected outcome is authored from the reference-local contract: the ordinary reference is satisfied once by the complete host and stays silent, while only the checklist reference judges the quiet host.
 * @evidence contracts/testing.md#distinguishing-cases The same two hosts are judged by two references that differ only by the checklist option, so the single checklist report and the absence of a missing-acknowledgement message separate a checklist that leaked into the ordinary reference from one that did not apply.
 * @evidence contracts/testing.md#execution-ownership TestChecklistStaysLocalToItsOwnReference is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
