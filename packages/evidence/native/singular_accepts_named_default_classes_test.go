package evidence

import (
  "testing"
)

/**
 * Verifies a named default class keeps its declared name.
 *
 * The negative twin of the anonymous class above: the branch must key on the
 * missing name, never on the default modifier, or every named default export
 * becomes a violation.
 *
 *  1. Default-export a named class.
 *  2. Run the rule against a file of that name.
 *  3. Assert silence.
 *
 * @evidence contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert silence.
 * @evidence contracts/testing.md#independent-expectations The negative twin of the anonymous class above: the branch must key on the missing name, never on the default modifier, or every named default export becomes a violation. The authored scenario requires this outcome: Assert silence.
 * @evidence contracts/testing.md#distinguishing-cases Default-export a named class. Run the rule against a file of that name. Assert silence.
 * @evidence contracts/testing.md#execution-ownership TestSingularAcceptsNamedDefaultClasses runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularAcceptsNamedDefaultClasses(t *testing.T) {
  assertSilent(t, runSingularRule(t, "src/Service.ts", `
export default class Service {}
`))
}
