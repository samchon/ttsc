package evidence

import (
  "testing"
)

/**
 * Verifies a deactivated claim still governs the files it declared.
 *
 * Governance was judged against the configuration as activated, and a claim
 * whose population materializes no unit of its symbol kind is dropped there. A
 * file whose every declaration an author commented out produces no unit, so the
 * claim deactivated and the file it declared fell out of the population, and
 * the citation stranded in that commented-out code went unreported. That is the
 * exact shape the diagnostic's second repair clause exists for, so the question
 * is what the author declared rather than what survived activation.
 *
 *  1. Comment out every declaration of the only file a claim selects.
 *  2. Evaluate the claim, which therefore activates nothing.
 *  3. Assert the stranded citation is still reported.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule reports exactly the unreadable citation at source line 1 after every selected declaration has been commented out.
 * @evidence contracts/testing.md#independent-expectations Declared file governance survives claim deactivation: no materialized property does not make a configured source comment disappear. The literal retired tag and line fix the expected diagnostic.
 * @evidence contracts/testing.md#distinguishing-cases A commented-out variable and export {} leave the property population empty while src/** still selects the file. This distinguishes declared governance from active-unit selection.
 * @evidence contracts/testing.md#execution-ownership TestADeactivatedClaimStillGovernsWhatItDeclared is the Go unit entry discovered beside the native package. runIndexRule evaluates its single source and configuration fixture in the native test process, with no consumer install or product host.
 */
func TestADeactivatedClaimStillGovernsWhatItDeclared(t *testing.T) {
  assertReported(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Pricing {#pricing}\n",
    "src/contracts.ts": `// /** @evidence docs/spec.md#pricing The whole file is retired. */
// export const limit = 1;
export {};
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"property",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`), "Unreadable @evidence at src/contracts.ts:1")
}
