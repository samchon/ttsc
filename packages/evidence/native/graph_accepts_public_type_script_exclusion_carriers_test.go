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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a public TypeScript export may carry an exclusion for a claim whose selected ownership host has another symbol kind. The original assertions check assert both claims are completely acknowledged without widening symbols.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Central exclusion ledgers are deliberately data exports so they cannot be mistaken for an operation or DTO. Requiring the claim selector to include that property would couple reviewed non-applicability to ownership evidence. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Select function and type ownership hosts in separate claim files. Put each exclusion on a public property carrier in its matching file. Assert both claims are completely acknowledged without widening symbols. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphAcceptsPublicTypeScriptExclusionCarriers is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
