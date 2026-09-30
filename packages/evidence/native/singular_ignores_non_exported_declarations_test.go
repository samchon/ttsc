package evidence

import (
  "testing"
)

/**
 * Verifies non-exported declarations are invisible to the rule.
 *
 * The rule is about the public surface. A module with helpers and one export
 * must be judged on the export alone, or every implementation file with private
 * helpers becomes a violation.
 *
 *  1. Declare two local helpers beside one exported identity.
 *  2. Run the rule against a file named after the export.
 *  3. Assert silence.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert silence.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The rule is about the public surface. A module with helpers and one export must be judged on the export alone, or every implementation file with private helpers becomes a violation. The authored scenario requires this outcome: Assert silence.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Declare two local helpers beside one exported identity. Run the rule against a file named after the export. Assert silence.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSingularIgnoresNonExportedDeclarations runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularIgnoresNonExportedDeclarations(t *testing.T) {
  assertSilent(t, runSingularRule(t, "src/publish.ts", `
const cache = new Map<string, string>();
function normalize(value: string): string {
  return value.trim();
}
export const publish = (value: string): string => normalize(value) + cache.size;
`))
}
