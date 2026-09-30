package evidence

import (
  "testing"
)

/**
 * Verifies TypeScript callable claim hosts: JSDoc on arrow constants,
 * instance methods, static methods, and namespace functions is accepted.
 *
 * These declarations attach JSDoc to different AST shapes. Exercising them
 * through the complete project rule prevents one syntactic form from becoming
 * a source unit that can never bear a valid acknowledgement.
 *
 *  1. Materialize four Markdown source headings.
 *  2. Cite one from each documented callable host form.
 *  3. Assert the function-only claim group is complete.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the function-only claim group is complete.
 * @evidence contracts/testing.md#independent-expectations These declarations attach JSDoc to different AST shapes. Exercising them through the complete project rule prevents one syntactic form from becoming a source unit that can never bear a valid acknowledgement. The authored scenario requires this outcome: Assert the function-only claim group is complete.
 * @evidence contracts/testing.md#distinguishing-cases Materialize four Markdown source headings. Cite one from each documented callable host form. Assert the function-only claim group is complete.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptFunctionClaimAcceptsEveryCallableHost runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptFunctionClaimAcceptsEveryCallableHost(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": `## Arrow
## Instance
## Static
## Field
## Typed Field
## Namespace
`,
    "src/api.ts": `
/** @evidence docs/spec.md#arrow Arrow handler implements this section. */
export const arrow = (): void => {};

export class Service {
  /** @evidence docs/spec.md#instance Instance method implements this section. */
  run(): void {}

  /** @evidence docs/spec.md#static Static method implements this section. */
  static create(): void {}

  /** @evidence docs/spec.md#field Function field implements this section. */
  handler = (): void => {};

  /** @evidence docs/spec.md#typed-field Function-typed field implements this section. */
  callback!: () => void;
}

export namespace Api {
  /** @evidence docs/spec.md#namespace Namespace function implements this section. */
  export function send(): void {}
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/api.ts"],
    "symbol":"function",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertNoProblems(t, messages)
}
