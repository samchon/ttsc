package evidence

import (
  "testing"
)

/**
 * Verifies withdrawing one identity leaves a sibling sharing its host position.
 *
 * `export var price, live` is two identities and one statement, because
 * TypeScript attaches their documentation block to the wrapper. Giving up that
 * position whenever any identity reaching it is withdrawn refused a citation on
 * `live`, which nobody had tagged and which is fully public. The rule is that a
 * position is given up only when every identity reaching it is gone.
 *
 * Asserting silence would not do. An empty selected population is silent too,
 * so a change that stopped materializing the second declarator at all would
 * keep this green while the position it is about ceased to exist. The reference
 * therefore carries a section nobody cites, which makes the expected count one
 * rather than zero, and it is the exact count that constrains. Measured: `live`
 * losing its unit takes the count to zero, because the claim then has no
 * selected host left and deactivates; `live` losing its host takes it to three,
 * two unacknowledged sections and one refused host.
 *
 *  1. Withdraw one identity through a merged namespace and cite its public
 *     sibling on the shared statement.
 *  2. Evaluate a `symbol: "property"` claim over that file, against a reference
 *     holding one cited and one uncited section.
 *  3. Assert the uncited section is the only thing reported.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the uncited section is the only thing reported.
 * @evidence contracts/testing.md#independent-expectations `export var price, live` is two identities and one statement, because TypeScript attaches their documentation block to the wrapper. Giving up that position whenever any identity reaching it is withdrawn refused a citation on `live`, which nobody had tagged and which is fully public. The rule is that a position is given up only when every identity reaching it is gone. The authored scenario requires this outcome: Assert the uncited section is the only thing reported.
 * @evidence contracts/testing.md#distinguishing-cases Withdraw one identity through a merged namespace and cite its public sibling on the shared statement. Evaluate a `symbol: "property"` claim over that file, against a reference holding one cited and one uncited section. Assert the uncited section is the only thing reported.
 * @evidence contracts/testing.md#execution-ownership TestWithdrawalSparesASiblingSharingTheHostPosition runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestWithdrawalSparesASiblingSharingTheHostPosition(t *testing.T) {
  assertReported(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Pricing {#pricing}\n\n## Uncited {#uncited}\n",
    "src/values.ts": `
export namespace N {
  /**
   * @internal
   */
  export var price: number;
}
export namespace N {
  /** @evidence docs/spec.md#pricing The live field answers this. */
  export var price: number, live: number;
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/values.ts"],
    "symbol":"property",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`), "Missing acknowledgement for 'docs/spec.md#uncited'")
}
