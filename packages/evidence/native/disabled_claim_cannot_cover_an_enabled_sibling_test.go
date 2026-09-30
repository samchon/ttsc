package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies disabling one obligation cannot satisfy another with declarations
 * from the disabled claim's population.
 *
 * Evidence coverage is claim-local even when references select the same
 * target. A declaration that exists only in a disabled claim must disappear
 * with that claim rather than covering an enabled sibling by accident.
 *
 *  1. Let a disabled claim acknowledge the shared requirement.
 *  2. Leave an enabled sibling that cites the same requirement unacknowledged.
 *  3. Assert the enabled obligation still fails.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies disabling one obligation cannot satisfy another with declarations from the disabled claim's population. The original assertions check assert the enabled obligation still fails.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Evidence coverage is claim-local even when references select the same target. A declaration that exists only in a disabled claim must disappear with that claim rather than covering an enabled sibling by accident. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Let a disabled claim acknowledge the shared requirement. Leave an enabled sibling that cites the same requirement unacknowledged. Assert the enabled obligation still fails. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDisabledClaimCannotCoverAnEnabledSibling is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDisabledClaimCannotCoverAnEnabledSibling(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/requirement.md": "## Shared Requirement {#shared}\n",
    "src/staged.ts": `/** @evidence docs/requirement.md#shared Staged implementation. */
export interface IStaged {}
`,
    "src/live.ts": "export interface ILive {}\n",
  }, `{"claims":[
    {
      "type":"typescript",
      "disabled":true,
      "files":["src/staged.ts"],
      "symbol":"type",
      "reference":{"type":"markdown","files":["docs/requirement.md"],"symbol":"h2"}
    },
    {
      "type":"typescript",
      "files":["src/live.ts"],
      "symbol":"type",
      "reference":{"type":"markdown","files":["docs/requirement.md"],"symbol":"h2"}
    }
  ]}`)
  if len(messages) != 1 || !strings.Contains(messages[0], "Claim 2") ||
    !strings.Contains(messages[0], "Missing acknowledgement") {
    t.Fatalf("disabled evidence contaminated its enabled sibling:\n%s", strings.Join(messages, "\n"))
  }
}
