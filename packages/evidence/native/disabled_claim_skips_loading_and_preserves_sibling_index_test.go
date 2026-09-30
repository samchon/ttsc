package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a disabled claim performs no loading or evaluation while an enabled
 * sibling retains its original diagnostic identity.
 *
 * Filtering after graph loading would still report the disabled claim's
 * unreadable root. Rebuilding the claim slice with new indexes would instead
 * report the enabled sibling as Claim 1, sending the author to the wrong
 * configuration entry.
 *
 *  1. Disable Claim 1 behind an unreadable population root.
 *  2. Leave Claim 2 active with one unacknowledged Markdown section.
 *  3. Assert only the Claim 2 coverage failure survives.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a disabled claim performs no loading or evaluation while an enabled sibling retains its original diagnostic identity. The original assertions check assert only the Claim 2 coverage failure survives.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Filtering after graph loading would still report the disabled claim's unreadable root. Rebuilding the claim slice with new indexes would instead report the enabled sibling as Claim 1, sending the author to the wrong configuration entry. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Disable Claim 1 behind an unreadable population root. Leave Claim 2 active with one unacknowledged Markdown section. Assert only the Claim 2 coverage failure survives. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDisabledClaimSkipsLoadingAndPreservesSiblingIndex is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDisabledClaimSkipsLoadingAndPreservesSiblingIndex(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/live.md": "## Live Requirement {#live}\n",
    "src/live.ts":  "export interface ILive {}\n",
  }, `{"claims":[
    {
      "type":"typescript",
      "name":"Staged",
      "disabled":true,
      "root":"missing-source-root",
      "files":["**/*.ts"],
      "reference":{"type":"markdown","root":"missing-reference-root","files":["**/*.md"],"symbol":"h2"}
    },
    {
      "type":"typescript",
      "name":"Live",
      "files":["src/live.ts"],
      "symbol":"type",
      "reference":{"type":"markdown","files":["docs/live.md"],"symbol":"h2"}
    }
  ]}`)
  if len(messages) != 1 {
    t.Fatalf("expected only the enabled coverage failure, got:\n%s", strings.Join(messages, "\n"))
  }
  if !strings.Contains(messages[0], "Claim 2 ('Live')") ||
    !strings.Contains(messages[0], "Missing acknowledgement") {
    t.Fatalf("enabled sibling lost its original identity: %s", messages[0])
  }
  if strings.Contains(messages[0], "missing-source-root") ||
    strings.Contains(messages[0], "missing-reference-root") {
    t.Fatalf("disabled loaders leaked a diagnostic: %s", messages[0])
  }
}
