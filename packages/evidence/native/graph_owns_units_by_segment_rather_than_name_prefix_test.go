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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies ownership is decided by identity segment, not by name text. The original assertions check assert the nested member is covered and the longer name is still owed.
 * @evidence contracts/testing.md#independent-expectations A citation covers the declarations below it, and "below" has to mean a segment boundary: `Order` owns `Order.Line` and has nothing to do with `OrderLine`. Treating the shared text as containment would move one obligation under another's citation and report it as discharged, which is the failure this product exists to prevent. Nothing else in the suite states this boundary, and the search that finds owned units is narrowed for width. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Publish a namespace, its nested member, and a longer name sharing its text. Cite the namespace alone. Assert the nested member is covered and the longer name is still owed. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestGraphOwnsUnitsBySegmentRatherThanNamePrefix is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
