package evidence

import (
  "encoding/json"
  "testing"
)

/**
 * Verifies reference policy defaults preserve the original reference contract.
 *
 * Each option strengthens a single reference only when it is written as `true`. An omitted option and an explicit `false` therefore need the same zero-value native model, or merely adding the public properties would change every existing graph.
 *
 *  1. Decode one reference with no options and one declaring every option false.
 *  2. Inspect both native reference models.
 *  3. Assert every option retains its behavior-preserving zero value.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts omitted reference policy contrasts all four explicitly false policy flags without changing the zero-value model.
 *
 * @evidence contracts/testing.md#independent-expectations The reference base documents false defaults for opt-in policies. Both omission and four explicit false flags must leave NoExclude, UniqueEvidence, SingleEvidencePerSymbol, and Checklist false.
 *
 * @evidence contracts/testing.md#distinguishing-cases Omitted reference policy contrasts all four explicitly false policy flags without changing the zero-value model.
 *
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticReferencePolicyDefaultsPreserveReferenceBehavior is a Go unit entry in the native test process; it calls decodeGraphConfig on one in-memory JSON string with no filesystem, package installation, artifact build or product host, and loops over the two decoded references rather than a table of variants.
 */
func TestEvidenceSemanticReferencePolicyDefaultsPreserveReferenceBehavior(t *testing.T) {
  config, problems := decodeGraphConfig(json.RawMessage(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":[
      {"type":"markdown","files":["docs/a.md"]},
      {
        "type":"markdown",
        "files":["docs/b.md"],
        "noEvidenceExclude":false,
        "uniqueEvidence":false,
        "singleEvidencePerSymbol":false,
        "checklist":false
      }
    ]
  }]}`))
  if len(problems) != 0 {
    t.Fatalf("unexpected decode diagnostics: %v", problems)
  }
  for index, reference := range config.Claims[0].References {
    policy := reference.Policy
    if policy.NoExclude ||
      policy.UniqueEvidence ||
      policy.SingleEvidencePerSymbol ||
      policy.Checklist {
      t.Fatalf("reference %d did not preserve zero-value behavior: %+v", index, policy)
    }
  }
}
