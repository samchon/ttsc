package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies one declaration unhosted in several obligations draws one report naming all of them.
 *
 * The eager report was per reference, so one tag drew one message per checklist that recorded it. The deferred report is per declaration, and nothing else pins that: a regression emitting one message per obligation, or dropping an obligation from the join, leaves every other arm green.
 *
 *  1. Record one carrier exclusion in two checklist references over one document, with nothing consuming it.
 *  2. Assert exactly one unhosted report fires.
 *  3. Assert it names both obligations and the selected host kinds the repair points at.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with one claim selecting function and property units and two identical Markdown checklist references, over an `@evidenceExclude` on an interface with no property host and a cited function; the test requires exactly one `Unhosted` diagnostic containing `for Claim 1 reference 1 (markdown, symbols: h2); Claim 1 reference 2 (markdown, symbols: h2)` and `Move the tag onto a host of a selected kind (function, property) in a claim that owes it`.
 * @evidence contracts/testing.md#independent-expectations The expected sentence parts are authored: one tag recorded by two obligations draws one report that names both of them, and the host-kind list is the claim's own selection of function and property.
 * @evidence contracts/testing.md#distinguishing-cases Two obligations over the same document guard against one message per obligation (count two) and against dropping an obligation from the join (only one reference named); two selected kinds show the parenthetical follows the claim's selection.
 * @evidence contracts/testing.md#execution-ownership TestChecklistJoinsEveryObligationIntoOneUnhostedReport is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestChecklistJoinsEveryObligationIntoOneUnhostedReport(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/rules.md": checklistDocument,
    "src/ledger.ts": `/** @evidenceExclude docs/rules.md#no-whack-a-mole This package has one code path. */
export interface ILedger {
  id: string;
}
`,
    "src/first.ts": `/** @evidence docs/rules.md#no-hardcoding The general logic decides. */
export function first(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":["function","property"],
    "reference":[
      {
        "type":"markdown",
        "files":["docs/rules.md"],
        "symbol":"h2",
        "checklist":true
      },
      {
        "type":"markdown",
        "files":["docs/rules.md"],
        "symbol":"h2",
        "checklist":true
      }
    ]
  }]}`)
  if count := countProblemsContaining(messages, "Unhosted"); count != 1 {
    t.Fatalf("expected one joined report, got %d:\n%s", count, strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "for Claim 1 reference 1 (markdown, symbols: h2); Claim 1 reference 2 (markdown, symbols: h2)")
  // Two selected kinds pin that the parenthetical is derived deterministically
  // from the claim's selection rather than spelled anywhere as a literal.
  assertProblemContains(t, messages, "Move the tag onto a host of a selected kind (function, property) in a claim that owes it")
}
