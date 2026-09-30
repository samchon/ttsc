package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a strict Swagger obligation does not prohibit an ordinary Markdown exclusion.
 *
 * A backend-test claim can cite API operations, requirements, and DTO contracts through separate references. The operation reference's anti-exclusion policy must not infect the ordinary documentary obligation beside it.
 *
 *  1. Configure a strict Swagger operation and an ordinary Markdown section in one claim.
 *  2. Exclude both targets from the same eligible function carrier.
 *  3. Assert only the operation exclusion fails and only the operation remains missing.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification evaluateEvidenceGraph exercises this case: Verifies a strict Swagger obligation does not prohibit an ordinary Markdown exclusion. The original assertions check assert only the operation exclusion fails and only the operation remains missing.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A backend-test claim can cite API operations, requirements, and DTO contracts through separate references. The operation reference's anti-exclusion policy must not infect the ordinary documentary obligation beside it. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Configure a strict Swagger operation and an ordinary Markdown section in one claim. Exclude both targets from the same eligible function carrier. Assert only the operation exclusion fails and only the operation remains missing. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestStrictSwaggerAndOrdinaryMarkdownExclusionsCoexist is the selectable Go test entry; its local loops and closures remain owned by this entry. It exercises evaluateEvidenceGraph within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestStrictSwaggerAndOrdinaryMarkdownExclusionsCoexist(t *testing.T) {
  host := &evidenceUnit{
    ID:       "typescript:src/test.ts:function:testContract",
    Target:   "testContract",
    Type:     artifactTypeScript,
    Symbol:   "function",
    Path:     "src/test.ts",
    Line:     5,
    Readable: "TypeScript function 'testContract'",
  }
  operation := &evidenceUnit{
    ID:       "swagger:openapi.json:POST:/orders",
    Target:   "POST:/orders",
    Type:     artifactSwagger,
    Symbol:   "operation",
    Path:     "openapi.json",
    Readable: "Swagger operation 'POST /orders'",
  }
  requirement := &evidenceUnit{
    ID:       "markdown:docs/requirement.md:h2:1",
    Target:   "docs/requirement.md#requirement",
    Type:     artifactMarkdown,
    Symbol:   "h2",
    Path:     "docs/requirement.md",
    Line:     1,
    Readable: "Markdown H2 'Requirement'",
  }
  messages := evaluateEvidenceGraph([]claimState{{
    Spec: claimSpec{
      Index:   0,
      Type:    artifactTypeScript,
      Symbols: symbolSet{"function": true},
    },
    Paths: []string{"src/test.ts"},
    Hosts: []*evidenceUnit{host},
    Declarations: []*evidenceDeclaration{
      {
        ID:               "operation-exclusion",
        HostID:           "src/test.ts:0:100",
        SemanticHostIDs:  []string{host.ID},
        Type:             artifactTypeScript,
        Tag:              tagExclude,
        Target:           operation.Target,
        Reason:           "No operation scenario exists.",
        Hosts:            symbolSet{"function": true},
        ExclusionCarrier: true,
        Path:             "src/test.ts",
        Line:             2,
      },
      {
        ID:               "requirement-exclusion",
        HostID:           "src/test.ts:0:100",
        SemanticHostIDs:  []string{host.ID},
        Type:             artifactTypeScript,
        Tag:              tagExclude,
        Target:           requirement.Target,
        Reason:           "The requirement is not applicable.",
        Hosts:            symbolSet{"function": true},
        ExclusionCarrier: true,
        Path:             "src/test.ts",
        Line:             3,
      },
    },
    Healthy: true,
    References: []referenceState{
      {
        Spec: referenceSpec{
          Index:   0,
          Type:    artifactSwagger,
          Policy:  referencePolicy{NoExclude: true},
          Symbols: symbolSet{"operation": true},
        },
        Paths:        []string{"openapi.json"},
        Units:        []*evidenceUnit{operation},
        Scopes:       []*evidenceUnit{operation},
        UnitsByScope: map[string][]*evidenceUnit{operation.ID: {operation}},
        Healthy:      true,
      },
      {
        Spec: referenceSpec{
          Index:   1,
          Type:    artifactMarkdown,
          Symbols: symbolSet{"h2": true},
        },
        Paths:        []string{"docs/requirement.md"},
        Units:        []*evidenceUnit{requirement},
        Scopes:       []*evidenceUnit{requirement},
        UnitsByScope: map[string][]*evidenceUnit{requirement.ID: {requirement}},
        Healthy:      true,
      },
    },
  }}, nil)
  if count := countProblemsContaining(messages, "Forbidden @evidenceExclude"); count != 1 {
    t.Fatalf("expected only the Swagger exclusion to be forbidden, got %d:\n%s", count, strings.Join(problemMessages(messages), "\n"))
  }
  assertProblemContains(t, messages, "Forbidden @evidenceExclude for 'POST:/orders'")
  if count := countProblemsContaining(messages, "Missing acknowledgement"); count != 1 {
    t.Fatalf("ordinary Markdown exclusion did not retain coverage, got %d missing diagnostics:\n%s", count, strings.Join(problemMessages(messages), "\n"))
  }
  assertProblemContains(t, messages, "Missing acknowledgement for 'POST:/orders'")
  if strings.Contains(strings.Join(problemMessages(messages), "\n"), "Missing acknowledgement for 'docs/requirement.md#requirement'") {
    t.Fatalf("strict Swagger policy leaked into the Markdown reference:\n%s", strings.Join(problemMessages(messages), "\n"))
  }
}
