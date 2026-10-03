package evidence

import (
  "encoding/json"
  "testing"
)

/**
 * Verifies named re-exports preserve the complete namespace accessor path.
 *
 * A module namespace contributes public paths without a declaration of its
 * own. Flattening its surface to one segment loses its members and aliases.
 *
 * 1. Re-export one value through two namespace aliases and a named forwarding hop.
 * 2. Cite both legitimate paths and verify they still reach one unit.
 * 3. Forward an empty namespace beside it and verify no false missing-export error.
 *
 * @evidence contracts/testing.md#behavioral-verification newFileLinkFixture builds a value re-exported through `export * as a` and `export * as b`, a named forwarding hop `export { ns as Public }`, and an empty namespace `export { empty }`; the graph must be clean for a Markdown link `#Public.a.value`, then (with a review.ts citing `{@link Public.a.value}` and the Markdown link switched to `#Public.b.value`) clean again, and clean under a TypeScript claim over review.ts.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the addressing contract: both namespace aliases end at the same value, the complete accessor path is preserved across the named forwarding hop, and an empty forwarded namespace contributes no member and so must cause no missing-export error.
 * @evidence contracts/testing.md#distinguishing-cases Two alias paths to one unit, an empty namespace beside them, and the same paths cited from Markdown and from inline TypeScript; flattening a namespace to one segment would lose `a` or `b`, and treating the empty namespace as a failure would add a diagnostic.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksForwardNamespaceExports is a Go unit entry in the native test process; it drives graphRule.Check through newFileLinkFixture over real temp files with in-process rewrites, with no consumer install or product host.
 */
func TestFileLinksForwardNamespaceExports(t *testing.T) {
  fixture := newFileLinkFixture(t, map[string]string{
    "api/value.ts":        "export const value = 1;",
    "api/nested.ts":       "export * as a from './value'; export * as b from './value';",
    "api/middle.ts":       "export * as ns from './nested';",
    "api/empty.ts":        "export {};",
    "api/empty-barrel.ts": "export * as empty from './empty';",
    "api/index.ts":        "export { ns as Public } from './middle'; export { empty } from './empty-barrel';",
    "review.md":           "## Review\n<!-- @link api/index.ts#Public.a.value Reads the first address. -->\n",
  }, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"api","files":["index.ts"],"symbol":"property"}}]}`)
  assertNoProblems(t, fixture.check())
  inline := "import type { Public } from './api/index';\n/** @evidence {@link Public.a.value} Reads the public value. */\nexport interface Review {}"
  fixture.write("review.ts", inline)
  fixture.sources = append(fixture.sources, fixture.source("review.ts", inline))
  fixture.write("review.md", "## Review\n<!-- @link api/index.ts#Public.b.value Reads the other address. -->\n")
  assertNoProblems(t, fixture.check())
  fixture.options = json.RawMessage(`{"claims":[{"type":"typescript","files":["review.ts"],"symbol":"type","reference":{"type":"typescript","root":"api","files":["index.ts"],"symbol":"property"}}]}`)
  assertNoProblems(t, fixture.check())
}
