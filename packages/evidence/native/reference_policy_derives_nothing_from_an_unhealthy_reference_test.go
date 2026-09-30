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
 * @evidence contracts/testing.md#behavioral-verification evaluateEvidenceGraph receives a healthy host and an unhealthy reference retaining one selected unit with both cardinality policies; it must return no findings.
 * @evidence contracts/testing.md#independent-expectations Partial unavailable data cannot establish missing coverage or cardinality even when its retained subset has one unit.
 * @evidence contracts/testing.md#distinguishing-cases One host with zero evidence would fail both policies if the reference were healthy; Healthy false is the decisive boundary, supplied directly without a loader.
 * @evidence contracts/testing.md#execution-ownership TestReferencePolicyDerivesNothingFromAnUnhealthyReference is a selectable native Go unit entry exercising the owning operations named in its behavioral answer in-process. Its direct fixture values and local comparisons require no installed artifact or product process.
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
