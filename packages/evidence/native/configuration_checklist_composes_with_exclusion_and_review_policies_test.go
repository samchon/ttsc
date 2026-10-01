package evidence

import (
  "encoding/json"
  "testing"
)

/**
 * Verifies the options a checklist composes with are left alone.
 *
 * Only the two cardinality options are unsatisfiable beside it. `noEvidenceExclude` and `requireReview` are the intended companions — the first demands positive evidence from every host, the second gives each host's answer its own expiry — so a refusal that over-reached would remove the reason to want a checklist at all.
 *
 *  1. Declare a checklist with both composable options.
 *  2. Decode the graph.
 *  3. Assert every option reaches the native policy with no diagnostic.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts checklist, noEvidenceExclude and requireReview remain enabled together without any diagnostic.
 *
 * @evidence contracts/testing.md#independent-expectations Markdown checklist documentation explicitly permits noEvidenceExclude and requireReview companions. All three literal true fields must reach the native policy without diagnostics.
 *
 * @evidence contracts/testing.md#distinguishing-cases Checklist, noEvidenceExclude and requireReview remain enabled together without any diagnostic.
 *
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticChecklistComposesWithExclusionAndReviewPolicies is the selectable unit entry in packages/evidence/native, compiled beside its owning implementation in the shared Go unit process. It invokes decodeGraphConfig and its decoder/assertion helpers in process; its JSON artifact/package names are input strings and trigger no installation, artifact loader, native plugin build, or child process. Its local table variants remain owned by this entry.
 */
func TestEvidenceSemanticChecklistComposesWithExclusionAndReviewPolicies(t *testing.T) {
  config, problems := decodeGraphConfig(json.RawMessage(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":{
      "type":"markdown",
      "files":["docs/**"],
      "checklist":true,
      "noEvidenceExclude":true,
      "requireReview":true
    }
  }]}`))
  if len(problems) != 0 {
    t.Fatalf("the composable options must decode beside a checklist: %v", problems)
  }
  policy := config.Claims[0].References[0].Policy
  if !policy.Checklist || !policy.NoExclude || !policy.RequireReview {
    t.Fatalf("a composable option was dropped: %+v", policy)
  }
}
