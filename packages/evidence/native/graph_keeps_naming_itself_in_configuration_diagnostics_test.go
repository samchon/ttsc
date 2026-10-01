package evidence

import "testing"

/**
 * Verifies the graph keeps naming itself.
 *
 * The graph counterpart to the documented rule configuration controls. Threading an owner through shared
 * decoders is exactly the change that can silently retitle every diagnostic of
 * the rule that was already correct.
 *
 *  1. Configure `evidence/graph` with a misspelled property.
 *  2. Run the project rule.
 *  3. Assert the message still names `evidence/graph`.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a claim carrying the misspelled key `symbolz`; assertProblemContains requires `Invalid evidence/graph configuration at claims[0].symbolz`.
 * @evidence contracts/testing.md#independent-expectations The expected message is an authored literal: the graph rule must keep naming itself (and the exact claim path) in configuration diagnostics after the shared decoders were made owner-aware for the documented rule.
 * @evidence contracts/testing.md#distinguishing-cases One unknown claim key on the graph rule; the documented rule's own attribution is covered by the sibling documented entries, so a regression that retitled the graph's messages fails only here.
 * @evidence contracts/testing.md#execution-ownership TestGraphKeepsNamingItselfInConfigurationDiagnostics is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestGraphKeepsNamingItselfInConfigurationDiagnostics(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/sale.ts":  "export interface ISale { id: string; }\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/sale.ts"],
    "symbolz":"type",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "Invalid evidence/graph configuration at claims[0].symbolz")
}
