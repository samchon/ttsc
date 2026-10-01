package evidence

import (
  "encoding/json"
  "testing"
)

/**
 * Verifies a misspelled carrier property is still rejected by name.
 *
 * The accepted-property set is the only thing standing between a typo and a claim that confines nothing while reading as if it confines everything. Widening that set is the correct way to add the property; deleting the rejection would be the cheap one, and this case tells the two apart by requiring the rejection to fire *and* the offered list to name the real spelling.
 *
 *  1. Write the singular misspelling `evidenceExcludeCarrier`.
 *  2. Decode the claim.
 *  3. Assert the unknown-property diagnostic fires and offers the plural name.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts a singular misspelling must be refused, offer the plural key and keep the rejected claim out of the model.
 *
 * @evidence contracts/testing.md#independent-expectations The published property is plural evidenceExcludeCarriers. The singular typo must be rejected at its literal claim path, offer the real name, and admit no malformed claim.
 *
 * @evidence contracts/testing.md#distinguishing-cases A singular misspelling must be refused, offer the plural key and keep the rejected claim out of the model.
 *
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticMisspelledExclusionCarrierPropertyIsRejected is a Go unit entry in the native test process; it calls decodeGraphConfig on one in-memory JSON string with no filesystem, package installation, artifact build or product host, and has a single case with no table.
 */
func TestEvidenceSemanticMisspelledExclusionCarrierPropertyIsRejected(t *testing.T) {
  config, problems := decodeGraphConfig(json.RawMessage(`{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"function",
    "evidenceExcludeCarrier":["src/EVIDENCE_EXCLUDE.ts"],
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`))
  assertProblemContains(t, problems, "claims[0].evidenceExcludeCarrier: unknown property")
  assertProblemContains(t, problems, "evidenceExcludeCarriers")
  if len(config.Claims) != 0 {
    t.Fatalf("a rejected claim must not reach the graph: %+v", config.Claims)
  }
}
