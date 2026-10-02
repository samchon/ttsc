package evidence

import "testing"

/**
 * Verifies a public TypeScript export may carry an exclusion for a claim whose
 * selected ownership host has another symbol kind.
 *
 * Central exclusion ledgers are deliberately data exports so they cannot be
 * mistaken for an operation or DTO. Requiring the claim selector to include
 * that property would couple reviewed non-applicability to ownership evidence.
 *
 *  1. Select function and type ownership hosts in separate claim files.
 *  2. Put each exclusion on a public property carrier in its matching file.
 *  3. Assert both claims are completely acknowledged without widening symbols.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule over two claims (`api-operations`, function hosts under src/controllers, and `dto-types`, type hosts under src/structures), each file carrying an `@evidenceExclude` for its own Markdown heading on a public `export const ..._EVIDENCE_EXCLUDE = true` beside one selected host; assertNoProblems requires an empty list.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the carrier contract: central exclusion ledgers are public data exports, so a property carrier may exclude a section for a claim whose selected hosts are functions or types without the selector being widened to properties.
 * @evidence contracts/testing.md#distinguishing-cases A function claim and a type claim, each with a carrier of another symbol kind in its own file; a rule that required the carrier's kind to be selected would leave an unacknowledged heading in both.
 * @evidence contracts/testing.md#execution-ownership TestGraphAcceptsPublicTypeScriptExclusionCarriers is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestGraphAcceptsPublicTypeScriptExclusionCarriers(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/controller.md": "## Controller\n",
    "docs/dto.md":        "## DTO\n",
    "src/controllers/CONTROLLER_EVIDENCE_EXCLUDE.ts": `
/**
 * Central controller exclusions.
 *
 * @evidenceExclude docs/controller.md#controller This package intentionally exposes no operation for the section.
 */
export const CONTROLLER_EVIDENCE_EXCLUDE = true;
export function selectedController(): void {}
`,
    "src/structures/DTO_EVIDENCE_EXCLUDE.ts": `
/**
 * Central DTO exclusions.
 *
 * @evidenceExclude docs/dto.md#dto This package intentionally exposes no DTO for the section.
 */
export const DTO_EVIDENCE_EXCLUDE = true;
export interface SelectedDto {}
`,
  }, `{"claims":[{
    "name":"api-operations",
    "type":"typescript",
    "files":["src/controllers/**/*.ts"],
    "symbol":"function",
    "reference":{"type":"markdown","files":["docs/controller.md"],"symbol":"h2"}
  },{
    "name":"dto-types",
    "type":"typescript",
    "files":["src/structures/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/dto.md"],"symbol":"h2"}
  }]}`)
  assertNoProblems(t, messages)
}
