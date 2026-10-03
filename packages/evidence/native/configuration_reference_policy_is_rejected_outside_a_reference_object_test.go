package evidence

import (
  "encoding/json"
  "testing"
)

/**
 * Verifies the policy belongs to a reference object and to no other level.
 *
 * A claim-level option would silently pool constraints across independent references, letting a permitted Markdown exclusion inherit a strict Swagger operation policy. The retired nested `acknowledgement` object must be equally dead, so configuration written against the earlier shape fails loudly instead of decoding into a policy that is silently inactive.
 *
 *  1. Put an option beside the claim selectors.
 *  2. Put the same options inside a retired nested `acknowledgement` object.
 *  3. Assert both paths report an unknown property.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts claim-level policy and retired nested acknowledgement configuration are both rejected at their distinct literal paths.
 *
 * @evidence contracts/testing.md#independent-expectations The published flags live directly on one reference, not on the claim or a retired acknowledgement object. Both authored misuse paths must report their distinct unknown-property findings.
 *
 * @evidence contracts/testing.md#distinguishing-cases Claim-level policy and retired nested acknowledgement configuration are both rejected at their distinct literal paths.
 *
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticReferencePolicyIsRejectedOutsideAReferenceObject is a Go unit entry in the native test process; it calls decodeGraphConfig twice on in-memory JSON strings with no filesystem, package installation, artifact build or product host, and has no table of variants.
 */
func TestEvidenceSemanticReferencePolicyIsRejectedOutsideAReferenceObject(t *testing.T) {
  _, claimLevel := decodeGraphConfig(json.RawMessage(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "noEvidenceExclude":true,
    "reference":{"type":"markdown","files":["docs/**"]}
  }]}`))
  assertProblemContains(t, claimLevel, "claims[0].noEvidenceExclude: unknown property")

  _, nested := decodeGraphConfig(json.RawMessage(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":{
      "type":"markdown",
      "files":["docs/**"],
      "acknowledgement":{"noEvidenceExclude":true,"singleEvidencePerSymbol":true}
    }
  }]}`))
  assertProblemContains(t, nested, "claims[0].reference.acknowledgement: unknown property")
}
