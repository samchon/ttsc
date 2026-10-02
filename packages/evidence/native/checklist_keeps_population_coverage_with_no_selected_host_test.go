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
 *
 * @evidence contracts/testing.md#behavioral-verification evaluateEvidenceGraph is called directly on one hand-built healthy claim state (function symbols, path src/test.ts, no hosts) with a checklist Markdown reference holding one unacknowledged h2 unit `docs/rules.md#only-rule`; assertProblemContains requires `Missing acknowledgement for 'docs/rules.md#only-rule'`.
 * @evidence contracts/testing.md#independent-expectations The expected message is an authored literal: when a checklist reference has no selected host to carry per-host reporting, the population-wide coverage question must still be answered. The claim state is built by hand because the shape is not reachable through the normal activation path, so this pins the evaluator invariant rather than an end-to-end flow.
 * @evidence contracts/testing.md#distinguishing-cases One empty-host-set checklist against one unacknowledged unit; the per-host reports with hosts present are owned by sibling checklist entries.
 * @evidence contracts/testing.md#execution-ownership TestChecklistKeepsPopulationCoverageWithNoSelectedHost is a Go unit entry in the native test process; it calls evaluateEvidenceGraph on in-memory claim and reference states with no fixture files, consumer install or product host.
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
