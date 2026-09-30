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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule keeps type/property claims active beside a function citation and requires one scope finding naming both claims plus two missing acknowledgements.
 * @evidence contracts/testing.md#independent-expectations No owning selector admits the function; its invalid citation must neither cover the references nor be duplicated per claim.
 * @evidence contracts/testing.md#distinguishing-cases Separate SelectedType and selectedProperty anchors make activation observable through two missing obligations.
 * @evidence contracts/testing.md#execution-ownership TestOverlappingClaimsReportOneGenuineOutOfScopeDeclaration is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
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
