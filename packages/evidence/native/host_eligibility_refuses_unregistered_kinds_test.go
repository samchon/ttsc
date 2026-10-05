package evidence

import (
  "testing"
)

// refusedHostConfig is one claim selecting `symbol`, citing one Markdown H2.
//
// Every case in this file asserts the same pair: the citation is refused as an
// out-of-scope host, and the section it named stays unacknowledged. The second
// half is what keeps the first from passing on a claim that never ran, since a
// refusal and a deactivated claim both leave the tag uncounted.
func refusedHostConfig(symbol string) string {
  return `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"` + symbol + `",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`
}

// assertHostRefused runs one source against one selector and pins both halves.
//
// Every fixture carries an uncited declaration of the selected kind. Without one
// the claim has no selected host, `claimIsInactive` drops it before evaluation,
// and the run is silent for a reason that has nothing to do with the refusal
// under test.
//
// `kind` is the host set the refused declaration really registers, and asserting
// it is what makes a row measure a registration rather than a rejection.
// Matching the selector half alone left every row green when the diagnostic was
// made to name a kind the declaration does not have, which is exactly the answer
// an over-broad registration produces.
func assertHostRefused(t *testing.T, source string, symbol string, kind string) {
  t.Helper()
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md":     "## Contract {#contract}\n",
    "src/contracts.ts": source,
  }, refusedHostConfig(symbol))
  assertProblemContains(
    t,
    messages,
    "host kind '"+kind+"' is not selected ("+symbol+")",
  )
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#contract'")
}

const refusedInterfaceSource = `
/** @evidence docs/spec.md#contract An interface is not a callable. */
export interface ISale {
  price: number;
}
export function activate(): void {}
`

const refusedTypeAliasSource = `
/** @evidence docs/spec.md#contract A type alias is not a callable. */
export type TSale = {
  price: number;
};
export function activate(): void {}
`

const refusedNamespaceSource = `
/** @evidence docs/spec.md#contract A namespace is not a callable. */
export namespace Orders {
  export interface Input {
    id: string;
  }
}
export function activate(): void {}
`
