package evidence

import "testing"

/**
 * Verifies the graph keeps naming itself.
 *
 * The negative twin of both cases above. Threading an owner through shared
 * decoders is exactly the change that can silently retitle every diagnostic of
 * the rule that was already correct.
 *
 *  1. Configure `evidence/graph` with a misspelled property.
 *  2. Run the project rule.
 *  3. Assert the message still names `evidence/graph`.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies the graph keeps naming itself. The original assertions check assert the message still names `evidence/graph`.
 * @evidence contracts/testing.md#independent-expectations The negative twin of both cases above. Threading an owner through shared decoders is exactly the change that can silently retitle every diagnostic of the rule that was already correct. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Configure `evidence/graph` with a misspelled property. Run the project rule. Assert the message still names `evidence/graph`. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestGraphKeepsNamingItselfInConfigurationDiagnostics is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
