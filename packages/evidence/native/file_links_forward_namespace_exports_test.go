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
