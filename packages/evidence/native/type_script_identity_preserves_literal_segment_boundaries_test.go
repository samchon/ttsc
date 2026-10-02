package evidence

import (
  "testing"
)

/**
 * Verifies dotted literal member names do not collapse with qualified class
 * identities that render to the same public target.
 *
 * The displayed target intentionally stays human-readable, but its internal
 * identity must retain segment boundaries. Otherwise a static literal method
 * silently overwrites an instance method rather than making the target
 * ambiguous.
 *
 *  1. Export an instance `run` and static `"prototype.run"` method.
 *  2. Cite their shared displayed target.
 *  3. Assert resolution sees two distinct callable units.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert resolution sees two distinct callable units.
 * @evidence contracts/testing.md#independent-expectations The displayed target intentionally stays human-readable, but its internal identity must retain segment boundaries. Otherwise a static literal method silently overwrites an instance method rather than making the target ambiguous. The authored scenario requires this outcome: Assert resolution sees two distinct callable units.
 * @evidence contracts/testing.md#distinguishing-cases Export an instance `run` and static `"prototype.run"` method. Cite their shared displayed target. Assert resolution sees two distinct callable units.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptIdentityPreservesLiteralSegmentBoundaries runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptIdentityPreservesLiteralSegmentBoundaries(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/contracts.ts": `export class Service {
  run(): void {}
  static "prototype.run"(): void {}
}
`,
    "src/ledger.ts": `import type { Service } from "./contracts";

/** @evidence {@link Service.prototype.run} This target cannot choose a callable. */
export interface ILedger {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ledger.ts"],
    "symbol":"type",
    "reference":{"type":"typescript","files":["src/contracts.ts"],"symbol":"function"}
  }]}`)
  assertProblemContains(t, messages, "Ambiguous evidence target '{@link Service.prototype.run}'")
  assertProblemContains(t, messages, "src/contracts.ts:2")
  assertProblemContains(t, messages, "src/contracts.ts:3")
}
