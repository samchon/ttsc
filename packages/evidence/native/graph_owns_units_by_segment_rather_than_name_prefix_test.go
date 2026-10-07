package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies ownership is decided by identity segment, not by name text.
 *
 * A citation covers the declarations below it, and "below" has to mean a
 * segment boundary: `Order` owns `Order.Line` and has nothing to do with
 * `OrderLine`. Treating the shared text as containment would move one
 * obligation under another's citation and report it as discharged, which is the
 * failure this product exists to prevent. Nothing else in the suite states this
 * boundary, and the search that finds owned units is narrowed for width.
 *
 *  1. Publish a namespace, its nested member, and a longer name sharing its
 *     text.
 *  2. Cite the namespace alone.
 *  3. Assert the nested member is covered and the longer name is still owed.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a type claim over src/ledger.ts and a TypeScript reference over src/index.ts selecting type and property, where the module has `namespace Order { interface Line }` and a separate `interface OrderLine { id }` and the ledger cites only `{@link Order}`; the test requires exactly two `Missing acknowledgement` diagnostics, for `'OrderLine'` and `'OrderLine.id'`.
 * @evidence contracts/testing.md#independent-expectations The expected owed units are authored from the containment contract: a citation covers what is below the target at a segment boundary, so `Order` covers `Order.Line` and has nothing to do with the longer name `OrderLine`.
 * @evidence contracts/testing.md#distinguishing-cases A nested member and a longer name sharing the cited name's text: a text-prefix ownership would credit `OrderLine` and its property (count zero), while a segment rule leaves exactly those two owed.
 * @evidence contracts/testing.md#execution-ownership TestGraphOwnsUnitsBySegmentRatherThanNamePrefix is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestGraphOwnsUnitsBySegmentRatherThanNamePrefix(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/contracts.ts": `export namespace Order {
  export interface Line { id: string }
}
export interface OrderLine { id: string }
`,
    "src/index.ts": "export * from \"./contracts.js\";\n",
    "src/ledger.ts": `import type { Order } from "./index";

/** @evidence {@link Order} Mirrors the order namespace and its members. */
export interface ILedger {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ledger.ts"],
    "symbol":"type",
    "reference":{"type":"typescript","files":["src/index.ts"],"symbol":["type","property"]}
  }]}`)
  if count := countProblemsContaining(messages, "Missing acknowledgement"); count != 2 {
    t.Fatalf("expected only the unrelated prefix twin and its property to remain owed, got %d:\n%s", count, strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "Missing acknowledgement for 'OrderLine'")
  assertProblemContains(t, messages, "Missing acknowledgement for 'OrderLine.id'")
}
