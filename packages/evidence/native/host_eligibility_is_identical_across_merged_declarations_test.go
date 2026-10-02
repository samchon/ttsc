package evidence

import (
  "testing"
)

/**
 * Verifies host eligibility does not depend on which half carries the tag.
 *
 * A claim selecting only `type` hosts must accept a citation from either
 * declaration, since both an interface and a namespace are type hosts. If the
 * halves offered different host kinds, the same citation would be in or out of
 * scope depending on where it was written.
 *
 *  1. Select only `type` hosts.
 *  2. Cite from each half in turn.
 *  3. Assert neither is reported as an out-of-scope host.
 *
 * @evidence contracts/testing.md#behavioral-verification For two sources (the `@evidence docs/spec.md#sale-price` block on `interface ISale`, and the same kind of block on the merged `namespace ISale`), runIndexRule runs the graph rule with a claim selecting only `type` hosts; the diagnostics must contain no message with `Out-of-scope` in either run.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the host contract: both an interface and a namespace are type hosts, so the same citation must be in scope whichever half carries it, not in or out depending on where it was written.
 * @evidence contracts/testing.md#distinguishing-cases The two placements are iterated over a map with the name in the failure message (plain iterations, not named subtests); only the absence of an out-of-scope diagnostic is asserted, not full silence.
 * @evidence contracts/testing.md#execution-ownership TestHostEligibilityIsIdenticalAcrossMergedDeclarations is a Go unit entry in the native test process that loops over two inline fixtures; runIndexRule writes each to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestHostEligibilityIsIdenticalAcrossMergedDeclarations(t *testing.T) {
  for name, source := range map[string]string{
    "interface host": `
/** @evidence docs/spec.md#sale-price The contract mirrors this pricing rule. */
export interface ISale {
  price: number;
}
export namespace ISale {
  export const version: string = "1";
}
`,
    "namespace host": `
export interface ISale {
  price: number;
}
/** @evidence docs/spec.md#sale-price The companion mirrors this pricing rule. */
export namespace ISale {
  export const version: string = "1";
}
`,
  } {
    messages := runIndexRule(t, map[string]string{
      "docs/spec.md": "## Sale Price {#sale-price}\n",
      "src/ISale.ts": source,
    }, `{"claims":[{
      "type":"typescript",
      "files":["src/**"],
      "symbol":"type",
      "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
    }]}`)
    if countProblemsContaining(messages, "Out-of-scope") != 0 {
      t.Fatalf("%s: both halves of a merge are type hosts, got:\n%v", name, messages)
    }
  }
}
