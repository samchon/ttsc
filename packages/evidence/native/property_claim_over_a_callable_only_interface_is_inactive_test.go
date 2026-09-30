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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule is exercised with the scenario below; the assertions require the inactive claim reports nothing.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations This is the quiet direction of the rule that classifies a member by how it is written. Reclassifying a member moves it out of one selector as well as into another, and the losing direction produces no diagnostic: a `property` claim over interfaces whose members are all callables now selects no host, and an inactive claim drops its whole reference obligation with a bare `continue`. The interface is still a `type` unit, so nothing but the narrowed selector makes this happen, which is exactly what makes it easy to miss.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Match a file whose only interface members are a method signature and a function-typed member. Point a `property` claim at it with an unacknowledged Markdown heading. Assert the inactive claim reports nothing.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPropertyClaimOverACallableOnlyInterfaceIsInactive is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
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
