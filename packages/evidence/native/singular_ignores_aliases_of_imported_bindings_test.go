package evidence

import (
  "testing"
)

/**
 * Verifies an alias of an imported binding is a re-export, not an identity.
 *
 * The declaration lives in the other module, so this file owns nothing. A rule
 * keyed on the export list alone would count it and demand the file be renamed
 * after someone else's declaration.
 *
 *  1. Import a binding and re-expose it under a new name.
 *  2. Run the rule against a file named after neither.
 *  3. Assert silence.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert silence.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The declaration lives in the other module, so this file owns nothing. A rule keyed on the export list alone would count it and demand the file be renamed after someone else's declaration. The authored scenario requires this outcome: Assert silence.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Import a binding and re-expose it under a new name. Run the rule against a file named after neither. Assert silence.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSingularIgnoresAliasesOfImportedBindings runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularIgnoresAliasesOfImportedBindings(t *testing.T) {
  assertSilent(t, runSingularRule(t, "src/facade.ts", `
import { alpha } from "./alpha";
export { alpha as Renamed };
export default alpha;
`))
}
