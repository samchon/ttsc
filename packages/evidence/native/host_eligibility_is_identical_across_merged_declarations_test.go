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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert neither is reported as an out-of-scope host.
 * @evidence contracts/testing.md#independent-expectations A claim selecting only `type` hosts must accept a citation from either declaration, since both an interface and a namespace are type hosts. If the halves offered different host kinds, the same citation would be in or out of scope depending on where it was written. The authored scenario requires this outcome: Assert neither is reported as an out-of-scope host.
 * @evidence contracts/testing.md#distinguishing-cases Select only `type` hosts. Cite from each half in turn. Assert neither is reported as an out-of-scope host.
 * @evidence contracts/testing.md#execution-ownership TestHostEligibilityIsIdenticalAcrossMergedDeclarations runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
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
