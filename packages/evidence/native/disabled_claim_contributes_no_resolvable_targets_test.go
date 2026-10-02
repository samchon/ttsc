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
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule over a disabled claim whose reference is docs/staged.md and an enabled claim over src/live.ts whose interface cites both `docs/live.md#live` and `docs/staged.md#staged`; the test requires exactly one message, containing `Unresolved evidence target 'docs/staged.md#staged'`.
 * @evidence contracts/testing.md#independent-expectations The expected message is authored from the activation contract: target lookup is built from active obligations only, so a section referenced solely by a disabled claim must be unresolved for the enabled claim's citation rather than leaking globally.
 * @evidence contracts/testing.md#distinguishing-cases The live citation resolves and is satisfied while the staged citation does not; the exact count of one message separates a leak (no message) from an additional participation failure (two messages).
 * @evidence contracts/testing.md#execution-ownership TestDisabledClaimContributesNoResolvableTargets is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
