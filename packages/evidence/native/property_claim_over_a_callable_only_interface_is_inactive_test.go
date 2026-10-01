package evidence

import (
  "testing"
)

/**
 * Verifies a property claim over an interface of callables is inactive.
 *
 * This is the quiet direction of the rule that classifies a member by how it is
 * written. Reclassifying a member moves it out of one selector as well as into
 * another, and the losing direction produces no diagnostic: a `property` claim
 * over interfaces whose members are all callables now selects no host, and an
 * inactive claim drops its whole reference obligation with a bare `continue`.
 * The interface is still a `type` unit, so nothing but the narrowed selector
 * makes this happen, which is exactly what makes it easy to miss.
 *
 *  1. Match a file whose only interface members are a method signature and a
 *     function-typed member.
 *  2. Point a `property` claim at it with an unacknowledged Markdown heading.
 *  3. Assert the inactive claim reports nothing.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs graphRule.Check with a property claim over an interface whose only members are a method signature and a function-typed member and a Markdown reference with an uncited h2; assertNoProblems requires no diagnostic at all.
 * @evidence contracts/testing.md#independent-expectations The interface, claim and uncited heading are authored literals; the expectation of silence follows from the contract that a property claim with no selected property host is inactive and owes nothing, not from a recorded graph output.
 * @evidence contracts/testing.md#distinguishing-cases Only the negative direction is exercised: callable members select no property host. The adjacent positive case (an interface with a data member making the claim live) is not in this body, and silence alone cannot separate an inactive claim from an unevaluated one.
 * @evidence contracts/testing.md#execution-ownership TestPropertyClaimOverACallableOnlyInterfaceIsInactive is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestPropertyClaimOverACallableOnlyInterfaceIsInactive(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/listener.ts": "export interface IListener {\n" +
      "  onOpen(): void;\n" +
      "  onMessage: (data: string) => void;\n" +
      "}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"property",
    "reference":{
      "type":"markdown",
      "files":["docs/**/*.md"],
      "symbol":"h2"
    }
  }]}`))
}
