package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a loader failure withholds the unhosted report rather than guessing.
 *
 * The report claims the tag discharges nothing anywhere, and a failed sibling population makes that unknowable: the tag may be exactly what that population consumes once it loads. Reporting anyway would derive a second claim from an incomplete graph, which is the same ghost-finding rule the non-participation chain already follows.
 *
 *  1. Evaluate a checklist beside a sibling reference, once failed and once healthy but empty.
 *  2. Leave an eligible carrier exclusion on a host the claim does not select.
 *  3. Assert the unhosted report is withheld under the failure and fires beside the healthy twin, while the host's shortfall survives both.
 *
 * @evidence contracts/testing.md#behavioral-verification evaluateEvidenceGraph is called directly on hand-built claim states holding a function host, a carrier `@evidenceExclude` on an unselected type, a checklist Markdown reference with one item and an ordinary sibling reference whose Healthy flag is false in one run and true in the other; the failed run must contain no `Unhosted` diagnostic, the healthy run must contain `Unhosted @evidenceExclude at src/ledger.ts:1`, and both must report the host owing `1 of 1` item.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the rule that an unhosted report claims the tag is consumed nowhere, which is unknowable while a sibling population failed to load; the states are built by hand to reach that combination directly, so this pins the evaluator rule rather than an end-to-end flow.
 * @evidence contracts/testing.md#distinguishing-cases Failed sibling against healthy-but-empty sibling with otherwise identical states: only the sibling health differs, and the host's checklist shortfall must survive in both.
 * @evidence contracts/testing.md#execution-ownership TestChecklistWithholdsTheUnhostedReportWhenALoaderFailureHidesConsumption is a Go unit entry in the native test process; it calls evaluateEvidenceGraph on in-memory states built by a local closure, with no fixture files, consumer install or product host.
 */
func TestChecklistWithholdsTheUnhostedReportWhenALoaderFailureHidesConsumption(t *testing.T) {
  unit := &evidenceUnit{
    ID:       "markdown:docs/rules.md:h2:1",
    Target:   "docs/rules.md#only-rule",
    Type:     artifactMarkdown,
    Symbol:   "h2",
    Path:     "docs/rules.md",
    Line:     1,
    Readable: "Markdown H2 'Only rule'",
  }
  build := func(siblingHealthy bool) []claimState {
    host := &evidenceUnit{
      ID:       "typescript:src/service.ts:function:1",
      Target:   "service",
      Type:     artifactTypeScript,
      Symbol:   "function",
      Path:     "src/service.ts",
      Line:     1,
      Readable: "TypeScript function 'service'",
    }
    exclusion := &evidenceDeclaration{
      ID:               "declaration:src/ledger.ts:1",
      SemanticHostIDs:  []string{"typescript:src/ledger.ts:type:1"},
      Type:             artifactTypeScript,
      Tag:              tagExclude,
      Target:           "docs/rules.md#only-rule",
      Reason:           "Nothing here applies.",
      Hosts:            symbolSet{"type": true},
      ExclusionCarrier: true,
      Path:             "src/ledger.ts",
      Line:             1,
    }
    return []claimState{{
      Spec: claimSpec{
        Index:   0,
        Type:    artifactTypeScript,
        Symbols: symbolSet{"function": true},
      },
      Paths:        []string{"src/service.ts", "src/ledger.ts"},
      Healthy:      true,
      Hosts:        []*evidenceUnit{host},
      Declarations: []*evidenceDeclaration{exclusion},
      References: []referenceState{
        {
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
        },
        {
          Spec: referenceSpec{
            Index:   1,
            Type:    artifactMarkdown,
            Symbols: symbolSet{"h2": true},
          },
          Healthy: siblingHealthy,
        },
      },
    }}
  }

  failed := evaluateEvidenceGraph(build(false), nil)
  if strings.Contains(strings.Join(problemMessages(failed), "\n"), "Unhosted") {
    t.Fatalf("an unknowable consumption was reported as none:\n%s", strings.Join(problemMessages(failed), "\n"))
  }
  assertProblemContains(t, failed, "has not acknowledged 1 of 1 checklist item(s): 'docs/rules.md#only-rule'")

  healthy := evaluateEvidenceGraph(build(true), nil)
  assertProblemContains(t, healthy, "Unhosted @evidenceExclude at src/ledger.ts:1")
  assertProblemContains(t, healthy, "has not acknowledged 1 of 1 checklist item(s): 'docs/rules.md#only-rule'")
}
