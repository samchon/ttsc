package evidence

import (
  "testing"
)

/**
 * Verifies slash and backslash characters in TypeScript literal names remain
 * exact symbol identity.
 *
 * Both literals are legal public method names, and treating either separator as
 * structure makes two distinct callable units ambiguous, leaving neither exact
 * target independently acknowledgeable.
 *
 * The path-normalization half of this hazard is now structural rather than
 * tested: a code target reaches resolution only as an inline link from a
 * TypeScript claim, and `normalizeMarkdownTarget` is never applied to one. What
 * remains worth pinning is that the segment boundary itself survives a
 * separator inside a literal name.
 *
 *  1. Export slash and backslash static literal methods.
 *  2. Acknowledge each exact target by link from one TypeScript claim.
 *  3. Assert both callable units resolve without collision.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert both callable units resolve without collision.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Both literals are legal public method names, and treating either separator as structure makes two distinct callable units ambiguous, leaving neither exact target independently acknowledgeable. The authored scenario requires this outcome: Assert both callable units resolve without collision.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Export slash and backslash static literal methods. Acknowledge each exact target by link from one TypeScript claim. Assert both callable units resolve without collision.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestTypeScriptLiteralTargetsKeepExactSeparators runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptLiteralTargetsKeepExactSeparators(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/contracts.ts": `export class Service {
  static "a\\b"(): void {}
  static "a/b"(): void {}
}
`,
    "src/ledger.ts": `import type { Service } from "./contracts";

/**
 * @evidence {@link Service.a\b} The backslash-named callable is documented.
 * @evidence {@link Service.a/b} The slash-named callable is documented.
 */
export interface ILedger {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ledger.ts"],
    "symbol":"type",
    "reference":{"type":"typescript","files":["src/contracts.ts"],"symbol":"function"}
  }]}`)
  assertNoProblems(t, messages)
}
