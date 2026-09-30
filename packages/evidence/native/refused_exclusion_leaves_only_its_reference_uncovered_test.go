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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule excludes a shared H2 under strict and ordinary references; one forbidden exclusion and one missing acknowledgement must identify the strict reference.
 * @evidence contracts/testing.md#independent-expectations NoExclude refusal leaves the strict obligation uncovered while the ordinary twin accepts its own exclusion.
 * @evidence contracts/testing.md#distinguishing-cases The same physical declaration challenges policy leakage in either direction; message fragments and both counts preserve the separate consequences.
 * @evidence contracts/testing.md#execution-ownership TestRefusedExclusionLeavesOnlyItsReferenceUncovered is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
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
