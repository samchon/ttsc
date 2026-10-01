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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule over a disabled claim `Staged` with nonexistent source and reference roots and an enabled claim `Live` whose Markdown section is uncited; the test requires exactly one message, containing `Claim 2 ('Live')` and `Missing acknowledgement`, and containing neither `missing-source-root` nor `missing-reference-root`.
 * @evidence contracts/testing.md#independent-expectations The expected message is authored from the staging contract: a disabled claim must neither load nor report its unreadable roots, and the enabled sibling keeps its original position in the configuration, so it is reported as Claim 2 rather than renumbered Claim 1.
 * @evidence contracts/testing.md#distinguishing-cases Unreadable roots on the disabled claim distinguish filtering after loading (extra root diagnostics) from skipping it; the second claim's index and name distinguish preserved indexes from a rebuilt claim list.
 * @evidence contracts/testing.md#execution-ownership TestDisabledClaimSkipsLoadingAndPreservesSiblingIndex is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
