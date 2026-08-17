package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies an unhosted checklist tag consumed by a sibling reference is not reported.
 *
 * Carrier eligibility is wider than the checklist's host gate, so one claim can hold an ordinary reference whose gathered carrier exclusion is legitimate and a checklist reference for which the same tag answers nothing. An eager report made that valid configuration inexpressible: no placement satisfied both references at once.
 *
 *  1. Declare an ordinary and a checklist reference over one document in one claim.
 *  2. Exclude one item from an exported interface the claim's `symbol` does not select, and cite the other item from a function.
 *  3. Assert the ordinary reference is silent, the checklist host owes only its unanswered item, and no unhosted report fires.
 */
func TestChecklistLeavesAnUnhostedTagASiblingReferenceConsumes(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/rules.md": checklistDocument,
    "src/ledger.ts": `/** @evidenceExclude docs/rules.md#no-whack-a-mole This package has one code path. */
export interface ILedger {
  id: string;
}
`,
    "src/first.ts": `/** @evidence docs/rules.md#no-hardcoding The general logic decides. */
export function first(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":[
      {
        "type":"markdown",
        "files":["docs/rules.md"],
        "symbol":"h2"
      },
      {
        "type":"markdown",
        "files":["docs/rules.md"],
        "symbol":"h2",
        "checklist":true
      }
    ]
  }]}`)
  if strings.Contains(strings.Join(messages, "\n"), "Unhosted") {
    t.Fatalf("a tag the ordinary reference consumed was reported as unhosted:\n%s", strings.Join(messages, "\n"))
  }
  if strings.Contains(strings.Join(messages, "\n"), "Missing acknowledgement") {
    t.Fatalf("the ordinary reference lost the carrier exclusion:\n%s", strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "TypeScript function 'first'")
  assertProblemContains(t, messages, "has not acknowledged 1 of 2 checklist item(s): 'docs/rules.md#no-whack-a-mole'")
  // Exactly the checklist shortfall. The count is what pins suppression to the
  // report about the tag alone: an implementation that also credited the host
  // with the excluded item would drop this to zero, and one that still refused
  // the tag would raise it to two.
  if len(messages) != 1 {
    t.Fatalf("expected the checklist shortfall alone, got:\n%s", strings.Join(messages, "\n"))
  }
}

/**
 * Verifies an unhosted checklist tag consumed by an overlapping claim is not reported.
 *
 * Two claims over one file set may select different host kinds against one document, so a declaration can be another claim's own selected host while the checklist claim's `symbol` ignores it. The tag is that claim's answer, and the checklist claim refusing it rejected a tag already owned elsewhere, which the evaluator's overlap rule forbids for every other finding of this kind.
 *
 *  1. Declare a checklist claim over functions and an ordinary claim over types, both selecting the same files and document.
 *  2. Exclude the document from the interface the ordinary claim selects, and answer every checklist item from the function.
 *  3. Assert the whole graph passes.
 */
func TestChecklistLeavesAnUnhostedTagAnOverlappingClaimConsumes(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/rules.md": checklistDocument,
    "src/ledger.ts": `/** @evidenceExclude docs/rules.md This module only stores records. */
export interface ILedger {
  id: string;
}
`,
    "src/first.ts": `/**
 * @evidence docs/rules.md#no-hardcoding The general logic decides.
 * @evidence docs/rules.md#no-whack-a-mole Every sibling case is covered.
 */
export function first(): void {}
`,
  }, `{"claims":[
    {
      "type":"typescript",
      "files":["src/**"],
      "symbol":"function",
      "reference":{
        "type":"markdown",
        "files":["docs/rules.md"],
        "symbol":"h2",
        "checklist":true
      }
    },
    {
      "type":"typescript",
      "files":["src/**"],
      "symbol":"type",
      "reference":{
        "type":"markdown",
        "files":["docs/rules.md"],
        "symbol":"h2"
      }
    }
  ]}`))
}

/**
 * Verifies a loader failure withholds the unhosted report rather than guessing.
 *
 * The report claims the tag discharges nothing anywhere, and a failed sibling population makes that unknowable: the tag may be exactly what that population consumes once it loads. Reporting anyway would derive a second claim from an incomplete graph, which is the same ghost-finding rule the non-participation chain already follows.
 *
 *  1. Evaluate a checklist beside a sibling reference, once failed and once healthy but empty.
 *  2. Leave an eligible carrier exclusion on a host the claim does not select.
 *  3. Assert the unhosted report is withheld under the failure and fires beside the healthy twin, while the host's shortfall survives both.
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
  if strings.Contains(strings.Join(failed, "\n"), "Unhosted") {
    t.Fatalf("an unknowable consumption was reported as none:\n%s", strings.Join(failed, "\n"))
  }
  assertProblemContains(t, failed, "has not acknowledged 1 of 1 checklist item(s): 'docs/rules.md#only-rule'")

  healthy := evaluateEvidenceGraph(build(true), nil)
  assertProblemContains(t, healthy, "Unhosted @evidenceExclude at src/ledger.ts:1")
  assertProblemContains(t, healthy, "has not acknowledged 1 of 1 checklist item(s): 'docs/rules.md#only-rule'")
}
