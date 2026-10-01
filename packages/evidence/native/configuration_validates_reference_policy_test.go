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
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticReferencePolicyDefaultsPreserveReferenceBehavior is the selectable unit entry in packages/evidence/native, compiled beside its owning implementation in the shared Go unit process. It invokes decodeGraphConfig and its decoder/assertion helpers in process; its JSON artifact/package names are input strings and trigger no installation, artifact loader, native plugin build, or child process. Its local table variants remain owned by this entry.
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
