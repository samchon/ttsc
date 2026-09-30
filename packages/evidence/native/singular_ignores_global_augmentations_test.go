package evidence

import (
  "testing"
)

/**
 * Verifies an ambient global augmentation is not an identity.
 *
 * `declare global` is a module declaration whose name is the identifier
 * `global`, so a rule reading the name alone would demand the file be called
 * `global.ts`.
 *
 *  1. Augment the global scope and declare nothing else public.
 *  2. Run the rule against an unrelated file name.
 *  3. Assert silence.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert silence.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations `declare global` is a module declaration whose name is the identifier `global`, so a rule reading the name alone would demand the file be called `global.ts`. The authored scenario requires this outcome: Assert silence.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Augment the global scope and declare nothing else public. Run the rule against an unrelated file name. Assert silence.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSingularIgnoresGlobalAugmentations runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularIgnoresGlobalAugmentations(t *testing.T) {
  assertSilent(t, runSingularRule(t, "src/ambient.ts", `
declare global {
  interface Window {
    evidence: string;
  }
}
export {};
`))
}
