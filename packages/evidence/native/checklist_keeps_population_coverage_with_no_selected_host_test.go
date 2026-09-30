package evidence

import "testing"

/**
 * Verifies coverage survives a checklist reference that selects no host.
 *
 * Per-host reporting subsumes the population-wide answer only while a host exists to carry it. An active claim with an empty host set is unreachable through `activeGraphConfig` today, so this pins the invariant at the evaluator instead: the population question must return rather than vanish, or a future selection change would silently drop the obligation.
 *
 *  1. Evaluate a checklist reference whose claim materialized no host.
 *  2. Leave the unit unacknowledged.
 *  3. Assert the population-wide missing acknowledgement is still reported.
 * @evidence contracts/testing.md#behavioral-verification evaluateEvidenceGraph exercises this case: Verifies coverage survives a checklist reference that selects no host. The original assertions check assert the population-wide missing acknowledgement is still reported.
 * @evidence contracts/testing.md#independent-expectations Per-host reporting subsumes the population-wide answer only while a host exists to carry it. An active claim with an empty host set is unreachable through `activeGraphConfig` today, so this pins the invariant at the evaluator instead: the population question must return rather than vanish, or a future selection change would silently drop the obligation. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Evaluate a checklist reference whose claim materialized no host. Leave the unit unacknowledged. Assert the population-wide missing acknowledgement is still reported. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestChecklistKeepsPopulationCoverageWithNoSelectedHost is the selectable Go test entry; its local loops and closures remain owned by this entry. It exercises evaluateEvidenceGraph within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestChecklistKeepsPopulationCoverageWithNoSelectedHost(t *testing.T) {
  unit := &evidenceUnit{
    ID:       "markdown:docs/rules.md:h2:1",
    Target:   "docs/rules.md#only-rule",
    Type:     artifactMarkdown,
    Symbol:   "h2",
    Path:     "docs/rules.md",
    Line:     1,
    Readable: "Markdown H2 'Only rule'",
  }
  messages := evaluateEvidenceGraph([]claimState{{
    Spec: claimSpec{
      Index:   0,
      Type:    artifactTypeScript,
      Symbols: symbolSet{"function": true},
    },
    Paths:   []string{"src/test.ts"},
    Healthy: true,
    References: []referenceState{{
      Spec: referenceSpec{
        Index:   0,
        Type:    artifactMarkdown,
        Policy:  referencePolicy{Checklist: true},
        Symbols: symbolSet{"h2": true},
      },
      Paths:        []string{"docs/rules.md"},
      Units:        []*evidenceUnit{unit},
      Scopes:       []*evidenceUnit{unit},
      UnitsByScope: map[string][]*evidenceUnit{unit.ID: {unit}},
      Healthy:      true,
    }},
  }}, nil)
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/rules.md#only-rule'")
}
