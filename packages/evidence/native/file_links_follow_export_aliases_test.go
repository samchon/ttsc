package evidence

import "testing"

/**
 * Verifies file-qualified addresses follow aliased default classes and anonymous functions.
 *
 * A barrel publishes addresses but owns no extra declaration. Reaching a
 * default by its alias must not double the denominator or lose class members.
 *
 * 1. Export four default class declaration forms through a named Public barrel alias.
 * 2. Cite its public addresses with file links.
 * 3. Verify all selected units are acknowledged once.
 *
 * @evidence contracts/testing.md#behavioral-verification Four t.Run rows write a default class in four forms (named declaration, anonymous, `export default Target`, `export { Target as default }`) and an index `export { default as Public }`; a review.md linking `src/index.ts#Public.property` must give no diagnostics under a property reference, and a separate anonymous `export default function` linked as `target.ts#default` under a function reference must give none.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the addressing contract: a barrel publishes addresses without owning another declaration, so reaching a default through its alias must reach the class member (or the anonymous function as `default`) without doubling the obligation; a clean graph means every selected unit was acknowledged by that one link.
 * @evidence contracts/testing.md#distinguishing-cases Four default-class declaration forms plus an anonymous default function; the failing forms are owned by the defaults-boundary entry, so this case only asserts that the legitimate paths resolve.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksFollowExportAliases is a Go unit entry in the native test process that owns four t.Run rows plus one direct case; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestFileLinksFollowExportAliases(t *testing.T) {
  for _, declaration := range []string{
    "export default class Target { static property = 1; }",
    "export default class { static property = 1; }",
    "class Target { static property = 1; } export default Target;",
    "class Target { static property = 1; } export { Target as default };",
  } {
    t.Run(declaration, func(t *testing.T) {
      assertNoProblems(t, runIndexRule(t, map[string]string{
        "src/target.ts":  declaration,
        "src/index.ts":   "export { default as Public } from './target';\n",
        "docs/review.md": "## Review\n<!-- @link ../src/index.ts#Public.property Checks the exported default. -->\n",
      }, `{"claims":[{"type":"markdown","files":["docs/review.md"],"symbol":"h2","reference":{"type":"typescript","files":["src/index.ts"],"symbol":"property"}}]}`))
    })
  }
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/target.ts":  "export default function (): void {}\n",
    "docs/review.md": "## Review\n<!-- @link ../src/target.ts#default Reviews the function. -->\n",
  }, `{"claims":[{"type":"markdown","files":["docs/review.md"],"symbol":"h2","reference":{"type":"typescript","files":["src/target.ts"],"symbol":"function"}}]}`))
}
