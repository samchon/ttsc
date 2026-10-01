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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule over a disabled claim on src/staged.ts, which cites `docs/requirement.md#shared`, and an enabled claim on the uncited src/live.ts with a reference to the same requirement; the test requires exactly one message, mentioning `Claim 2` and `Missing acknowledgement`.
 * @evidence contracts/testing.md#independent-expectations The expected single report is authored from the claim-locality contract: a declaration that exists only under a disabled claim must disappear with it, so the enabled sibling's obligation stays unmet and the disabled claim adds no message.
 * @evidence contracts/testing.md#distinguishing-cases The two claims share one requirement and differ by `disabled`; covering the enabled claim from the disabled file would give no message, and reporting the disabled claim would give a second message.
 * @evidence contracts/testing.md#execution-ownership TestDisabledClaimCannotCoverAnEnabledSibling is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
