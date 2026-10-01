package evidence

import (
  "encoding/json"
  "testing"
)

/**
 * Verifies the exclusion-refusing option answers to its new public name only.
 *
 * `noExclude` named the tag family ambiguously: every other public spelling in this surface says `evidence` out loud, and a reader had to already know that "exclude" meant `@evidenceExclude` rather than a population exclusion glob. The rename is breaking on purpose, so the retired spelling has to fail loudly — a silently ignored `noExclude` would decode into a reference that no longer refuses anything while its author still reads the option in the config.
 *
 *  1. Decode a reference declaring `noEvidenceExclude`.
 *  2. Decode the same reference declaring the retired `noExclude`.
 *  3. Assert the new name takes effect and the old one is refused by name.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts the enabled noEvidenceExclude spelling contrasts retired noExclude, whose rejection must offer the current name.
 *
 * @evidence contracts/testing.md#independent-expectations The current reference base publishes noEvidenceExclude; retired noExclude must fail by name and offer the current key, while true on the supported spelling reaches Policy.NoExclude.
 *
 * @evidence contracts/testing.md#distinguishing-cases The enabled noEvidenceExclude spelling contrasts retired noExclude, whose rejection must offer the current name.
 *
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticReferenceExclusionPolicyAnswersToItsRenamedKey is a Go unit entry in the native test process; it calls decodeGraphConfig twice on in-memory JSON strings with no filesystem, package installation, artifact build or product host, and has no table of variants.
 */
func TestEvidenceSemanticReferenceExclusionPolicyAnswersToItsRenamedKey(t *testing.T) {
  config, problems := decodeGraphConfig(json.RawMessage(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":{
      "type":"markdown",
      "files":["docs/**"],
      "noEvidenceExclude":true
    }
  }]}`))
  if len(problems) != 0 {
    t.Fatalf("the renamed option must decode: %v", problems)
  }
  if !config.Claims[0].References[0].Policy.NoExclude {
    t.Fatalf("the renamed option did not reach the native policy: %+v", config.Claims[0].References[0].Policy)
  }

  _, retired := decodeGraphConfig(json.RawMessage(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":{
      "type":"markdown",
      "files":["docs/**"],
      "noExclude":true
    }
  }]}`))
  assertProblemContains(t, retired, "claims[0].reference.noExclude: unknown property")
  assertProblemContains(t, retired, "noEvidenceExclude")
}
