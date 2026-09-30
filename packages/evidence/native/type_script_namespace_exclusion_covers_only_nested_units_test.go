package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies TypeScript namespace scopes: one namespace exclusion covers nested
 * public callables and data but not a top-level sibling.
 *
 * Namespace containment is structural. Prefix matching would confuse literal
 * dots and similarly named exports, while treating the entire file as one
 * scope would erase unrelated public contracts.
 *
 *  1. Put function and property units under one namespace plus one root value.
 *  2. Exclude the namespace by link while selecting only child kinds.
 *  3. Assert only the root sibling remains missing.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule excludes Orders across nested function/property units and requires exactly one missing version finding.
 * @evidence contracts/testing.md#independent-expectations Namespace scope includes descendants, while the top-level version value remains unrelated.
 * @evidence contracts/testing.md#distinguishing-cases Nested Retry.limit and Request.id challenge deeper containment; the root sibling detects an exclusion widened to the whole file.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptNamespaceExclusionCoversOnlyNestedUnits is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestTypeScriptNamespaceExclusionCoversOnlyNestedUnits(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/contracts.ts": `
export namespace Orders {
  export const count = 1;
  export function open(): void {}
  export interface Request {
    id: string;
  }
  export namespace Retry {
    export let limit = 3;
  }
}
export const version = 1;
`,
    "src/ledger.ts": `import type { Orders } from "./contracts";

/** @evidenceExclude {@link Orders} This contract intentionally omits the Orders API. */
export interface ILedger {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ledger.ts"],
    "symbol":"type",
    "reference":{"type":"typescript","files":["src/contracts.ts"],"symbol":["function","property"]}
  }]}`)
  if got := countProblemsContaining(messages, "Missing acknowledgement"); got != 1 {
    t.Fatalf("namespace exclusion produced %d missing findings:\n%s", got, strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "'version'")
}
