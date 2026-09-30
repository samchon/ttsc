package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies an unhealthy partial denominator produces no derived cardinality.
 *
 * A loader can materialize some units before discovering that its population is incomplete. Cardinality over that partial set would claim completeness from missing data, so the evaluator must defer entirely to the owning loader failure.
 *
 *  1. Supply a selected host and one retained unit under an unhealthy reference state.
 *  2. Enable both cardinality options with no positive evidence.
 *  3. Assert the evaluator derives neither cardinality nor missing coverage.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification evaluateEvidenceGraph exercises this case: Verifies an unhealthy partial denominator produces no derived cardinality. The original assertions check assert the evaluator derives neither cardinality nor missing coverage.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A loader can materialize some units before discovering that its population is incomplete. Cardinality over that partial set would claim completeness from missing data, so the evaluator must defer entirely to the owning loader failure. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Supply a selected host and one retained unit under an unhealthy reference state. Enable both cardinality options with no positive evidence. Assert the evaluator derives neither cardinality nor missing coverage. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestReferencePolicyDerivesNothingFromAnUnhealthyReference is the selectable Go test entry; its local loops and closures remain owned by this entry. It exercises evaluateEvidenceGraph within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestReferencePolicyDerivesNothingFromAnUnhealthyReference(t *testing.T) {
  host := &evidenceUnit{
    ID:       "typescript:src/test.ts:function:testContract",
    Target:   "testContract",
    Type:     artifactTypeScript,
    Symbol:   "function",
    Path:     "src/test.ts",
    Line:     1,
    Readable: "TypeScript function 'testContract'",
  }
  unit := &evidenceUnit{
    ID:       "markdown:docs/spec.md:h2:1",
    Target:   "docs/spec.md#contract",
    Type:     artifactMarkdown,
    Symbol:   "h2",
    Path:     "docs/spec.md",
    Line:     1,
    Readable: "Markdown H2 'Contract'",
  }
  messages := evaluateEvidenceGraph([]claimState{{
    Spec: claimSpec{
      Index:   0,
      Type:    artifactTypeScript,
      Symbols: symbolSet{"function": true},
    },
    Paths:   []string{"src/test.ts"},
    Hosts:   []*evidenceUnit{host},
    Healthy: true,
    References: []referenceState{{
      Spec: referenceSpec{
        Index: 0,
        Type:  artifactMarkdown,
        Policy: referencePolicy{
          UniqueEvidence:          true,
          SingleEvidencePerSymbol: true,
        },
        Symbols: symbolSet{"h2": true},
      },
      Paths:        []string{"docs/spec.md"},
      Units:        []*evidenceUnit{unit},
      Scopes:       []*evidenceUnit{unit},
      UnitsByScope: map[string][]*evidenceUnit{unit.ID: {unit}},
      Healthy:      false,
    }},
  }}, nil)
  if len(messages) != 0 {
    t.Fatalf("partial reference produced derived diagnostics instead of deferring to its loader failure:\n%s", strings.Join(problemMessages(messages), "\n"))
  }
}
