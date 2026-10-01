package evidence

import (
  "testing"
)

/**
 * Verifies the TypeScript source default: omitting symbol selects exported
 * interfaces, type aliases, classes, and namespaces without charging callable
 * or property units.
 *
 * The default is intentionally narrower than the claim default. A test that
 * merely inspects decoded options would miss a materializer that ignored the
 * selector and indexed every discovered declaration anyway.
 *
 * The class is here because the omitted selector now reaches it: remove it and
 * `{@link Sale}` stops resolving. Its members are along for the ride rather
 * than under test, since a citation of the class discharges its descendants
 * whether or not they are in the denominator, and this case cannot tell those
 * two apart.
 *
 *  1. Put types, a class with members, a namespace, properties, and callables
 *     in one source file.
 *  2. Acknowledge only the four type identities from a TypeScript claim.
 *  3. Assert the omitted source selector creates no additional obligation.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs graphRule.Check with a TypeScript reference that omits symbol; the ledger cites Shape, Options, Sale and Api only, and the graph must be clean. The four links must resolve, and the uncited top-level functions draw and render must not be demanded.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the contract that the omitted source selector means types, classes and namespaces. Uncited top-level callables would be reported unmet if the default included them. Members of cited Sale/Api and properties of Shape are discharged by their cited ancestor, so this case cannot show they are outside the default.
 * @evidence contracts/testing.md#distinguishing-cases The adjacent inputs draw and render are exported callables left uncited and must stay silent; the four cited kinds must stay resolvable. No case here selects callables explicitly to contrast the default.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptSourceDefaultMaterializesOnlyTypes runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptSourceDefaultMaterializesOnlyTypes(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/contracts.ts": `
export interface Shape { width: number; }
export type Options = { enabled: boolean };
export class Sale {
  readonly price: number = 0;
  charge(): void {}
}
export namespace Api {
  export const state = "ready";
  export function run(): void {}
}
export function draw(): void {}
export const render = (): void => {};
`,
    "src/ledger.ts": `import type { Api, Options, Sale, Shape } from "./contracts";

/**
 * @evidence {@link Shape} Shape is documented here.
 * @evidence {@link Options} Options are documented here.
 * @evidence {@link Sale} The subject contract is documented here.
 * @evidence {@link Api} The namespace contract is documented here.
 */
export interface ILedger {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ledger.ts"],
    "symbol":"type",
    "reference":{"type":"typescript","files":["src/contracts.ts"]}
  }]}`)
  assertNoProblems(t, messages)
}
