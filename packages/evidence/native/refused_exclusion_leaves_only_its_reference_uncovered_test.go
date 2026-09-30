package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a refused exclusion fails only its owning reference obligation.
 *
 * One declaration can resolve into overlapping references, but each reference owns its acknowledgement intent. The strict reference must report and remain uncovered while the ordinary twin accepts the same exclusion independently.
 *
 *  1. Point strict and ordinary references at the same Markdown section.
 *  2. Exclude the section from one selected function host.
 *  3. Assert only the strict reference reports the policy and missing coverage.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a refused exclusion fails only its owning reference obligation. The original assertions check assert only the strict reference reports the policy and missing coverage.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations One declaration can resolve into overlapping references, but each reference owns its acknowledgement intent. The strict reference must report and remain uncovered while the ordinary twin accepts the same exclusion independently. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Point strict and ordinary references at the same Markdown section. Exclude the section from one selected function host. Assert only the strict reference reports the policy and missing coverage. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestRefusedExclusionLeavesOnlyItsReferenceUncovered is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestRefusedExclusionLeavesOnlyItsReferenceUncovered(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract {#contract}\n",
    "src/test.ts": `/** @evidenceExclude docs/spec.md#contract Not applicable here. */
export function testContract(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":[
      {
        "type":"markdown",
        "files":["docs/spec.md"],
        "symbol":"h2",
        "noEvidenceExclude":true
      },
      {
        "type":"markdown",
        "files":["docs/spec.md"],
        "symbol":"h2"
      }
    ]
  }]}`)
  if count := countProblemsContaining(messages, "Forbidden @evidenceExclude"); count != 1 {
    t.Fatalf("expected one strict-reference exclusion diagnostic, got %d:\n%s", count, strings.Join(problemMessages(messages), "\n"))
  }
  assertProblemContains(t, messages, "reference 1 (markdown, symbols: h2): noEvidenceExclude")
  if count := countProblemsContaining(messages, "Missing acknowledgement"); count != 1 {
    t.Fatalf("the ordinary reference must remain acknowledged, got %d missing diagnostics:\n%s", count, strings.Join(problemMessages(messages), "\n"))
  }
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#contract'")
  assertProblemContains(t, messages, "this reference forbids @evidenceExclude")
}
