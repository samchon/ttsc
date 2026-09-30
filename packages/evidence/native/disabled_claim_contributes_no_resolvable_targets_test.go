package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies references owned only by a disabled claim contribute no resolvable
 * targets to an enabled sibling.
 *
 * Target lookup is assembled globally from active obligations. Filtering only
 * during coverage would leave a disabled reference addressable and turn a
 * genuinely unresolved declaration into a misleading participation failure.
 *
 *  1. Disable the only claim that references a staged Markdown section.
 *  2. Cite that staged section beside a valid citation in an enabled claim.
 *  3. Assert the staged target is unresolved rather than leaked globally.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule is exercised with the scenario below; the assertions require the staged target is unresolved rather than leaked globally.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Target lookup is assembled globally from active obligations. Filtering only during coverage would leave a disabled reference addressable and turn an actually unresolved declaration into a misleading participation failure.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Disable the only claim that references a staged Markdown section. Cite that staged section beside a valid citation in an enabled claim. Assert the staged target is unresolved rather than leaked globally.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDisabledClaimContributesNoResolvableTargets is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestDisabledClaimContributesNoResolvableTargets(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/live.md":   "## Live Requirement {#live}\n",
    "docs/staged.md": "## Staged Requirement {#staged}\n",
    "src/staged.ts":  "export interface IStaged {}\n",
    "src/live.ts": `/**
 * @evidence docs/live.md#live Live implementation.
 * @evidence docs/staged.md#staged Must not resolve through a disabled claim.
 */
export interface ILive {}
`,
  }, `{"claims":[
    {
      "type":"typescript",
      "disabled":true,
      "files":["src/staged.ts"],
      "symbol":"type",
      "reference":{"type":"markdown","files":["docs/staged.md"],"symbol":"h2"}
    },
    {
      "type":"typescript",
      "files":["src/live.ts"],
      "symbol":"type",
      "reference":{"type":"markdown","files":["docs/live.md"],"symbol":"h2"}
    }
  ]}`)
  if len(messages) != 1 ||
    !strings.Contains(messages[0], "Unresolved evidence target 'docs/staged.md#staged'") {
    t.Fatalf("disabled reference leaked into target resolution:\n%s", strings.Join(messages, "\n"))
  }
}
