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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule is exercised with the scenario below; the assertions require the enabled obligation still fails.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Evidence coverage is claim-local even when references select the same target. A declaration that exists only in a disabled claim must disappear with that claim rather than covering an enabled sibling by accident.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Let a disabled claim acknowledge the shared requirement. Leave an enabled sibling that cites the same requirement unacknowledged. Assert the enabled obligation still fails.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDisabledClaimCannotCoverAnEnabledSibling is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
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
