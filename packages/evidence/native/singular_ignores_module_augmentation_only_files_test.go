package evidence

import (
  "testing"
)

/**
 * Verifies module augmentation is not an identity.
 *
 * An augmentation names another module with a string literal. Counting it would
 * report every typings file that tightens a dependency's interface, and this
 * repository ships one.
 *
 *  1. Augment another module and declare nothing else.
 *  2. Run the rule against a file named after the augmented interface.
 *  3. Assert silence.
 *
 * @evidence contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert silence.
 * @evidence contracts/testing.md#independent-expectations An augmentation names another module with a string literal. Counting it would report every typings file that tightens a dependency's interface, and this repository ships one. The authored scenario requires this outcome: Assert silence.
 * @evidence contracts/testing.md#distinguishing-cases Augment another module and declare nothing else. Run the rule against a file named after the augmented interface. Assert silence.
 * @evidence contracts/testing.md#execution-ownership TestSingularIgnoresModuleAugmentationOnlyFiles runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularIgnoresModuleAugmentationOnlyFiles(t *testing.T) {
  assertSilent(t, runSingularRule(t, "src/ITtscLintRuleOptionsMap.ts", `
declare module "@ttsc/lint" {
  interface ITtscLintRuleOptionsMap {
    "evidence/graph": unknown;
  }
}
`))
}
