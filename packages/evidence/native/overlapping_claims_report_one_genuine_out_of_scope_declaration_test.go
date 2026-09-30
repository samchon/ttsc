package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a genuinely ineligible declaration is reported once across overlaps.
 *
 * Suppressing every ineligible overlap would hide a real misplaced tag, while
 * reporting per claim floods one source mistake into several diagnostics. The
 * declaration is therefore invalid only when no owning claim accepts its host,
 * and the one finding names every obligation it failed to join.
 *
 *  1. Activate type and property claims beside one function declaration.
 *  2. Resolve the function's target inside both references.
 *  3. Assert one scope finding names both claims while coverage remains missing.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a genuinely ineligible declaration is reported once across overlaps. The original assertions check assert one scope finding names both claims while coverage remains missing.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Suppressing every ineligible overlap would hide a real misplaced tag, while reporting per claim floods one source mistake into several diagnostics. The declaration is therefore invalid only when no owning claim accepts its host, and the one finding names every obligation it failed to join. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Activate type and property claims beside one function declaration. Resolve the function's target inside both references. Assert one scope finding names both claims while coverage remains missing. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestOverlappingClaimsReportOneGenuineOutOfScopeDeclaration is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestOverlappingClaimsReportOneGenuineOutOfScopeDeclaration(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/ref.ts": `
/** @evidence docs/spec.md#contract This function belongs to neither selector. */
export function ref(): void {}
export interface SelectedType {}
export const selectedProperty = true;
`,
  }, `{"claims":[
    {
      "name":"types",
      "type":"typescript",
      "files":["src/ref.ts"],
      "symbol":"type",
      "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
    },
    {
      "name":"properties",
      "type":"typescript",
      "files":["src/ref.ts"],
      "symbol":"property",
      "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
    }
  ]}`)
  if countProblemsContaining(messages, "Out-of-scope @evidence host") != 1 {
    t.Fatalf("expected one consolidated scope diagnostic, got:\n%s", strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "Claim 1 ('types') reference 1")
  assertProblemContains(t, messages, "Claim 2 ('properties') reference 1")
  if countProblemsContaining(messages, "Missing acknowledgement") != 2 {
    t.Fatalf("both independent obligations must stay uncovered:\n%s", strings.Join(messages, "\n"))
  }
}
