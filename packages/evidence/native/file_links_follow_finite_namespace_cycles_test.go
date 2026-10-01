package evidence

import "testing"

/**
 * Verifies finite citation paths can traverse cyclic module namespaces.
 *
 * Populations must remain finite, but the author can spell any finite public
 * accessor. Repeating a namespace hop still names the original declaration.
 *
 * 1. Export a self namespace and a namespace that returns through another module.
 * 2. Cite their repeated paths from Markdown and import-scoped TypeScript.
 * 3. Verify one unit remains one obligation through every address.
 *
 * @evidence contracts/testing.md#behavioral-verification For each of `self.value`, `self.self.value`, `other.back.value` and `other.back.self.other.back.value`, a Markdown link and an import-scoped TypeScript `{@link api.<path>}` citation over an index with `export * as self` and `export * as other` (whose module re-exports the index as `back`) must each leave the graph with no diagnostics.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the addressing contract: populations must stay finite but any finite accessor path that repeats a namespace hop still names the original declaration, so every spelling must acknowledge the single `value` unit.
 * @evidence contracts/testing.md#distinguishing-cases Four repeated and cross-module cycle paths, each through both a Markdown link and an inline TypeScript link; a traversal that rejected repeated hops, or one that counted each path as a separate unit, would fail.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksFollowFiniteNamespaceCycles is a Go unit entry in the native test process that loops over four paths (not named subtests); each iteration drives graphRule.Check through newFileLinkFixture and runIndexRule over temp files, with no consumer install or product host.
 */
func TestFileLinksFollowFiniteNamespaceCycles(t *testing.T) {
  for _, target := range []string{"self.value", "self.self.value", "other.back.value", "other.back.self.other.back.value"} {
    fixture := newFileLinkFixture(t, map[string]string{
      "api/index.ts": "export const value = 1; export * as self from './index'; export * as other from './other';",
      "api/other.ts": "export * as back from './index';",
      "review.md":    "## Review\n<!-- @link api/index.ts#" + target + " Reviews the value. -->\n",
    }, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"api","files":["index.ts"],"symbol":"property"}}]}`)
    assertNoProblems(t, fixture.check())
    source := "import type * as api from './api/index';\n/** @evidence {@link api." + target + "} Reviews the value. */\nexport interface Review {}"
    files := map[string]string{"api/index.ts": "export const value = 1; export * as self from './index'; export * as other from './other';", "api/other.ts": "export * as back from './index';", "review.ts": source}
    assertNoProblems(t, runIndexRule(t, files, `{"claims":[{"type":"typescript","files":["review.ts"],"symbol":"type","reference":{"type":"typescript","files":["api/index.ts"],"symbol":"property"}}]}`))
  }
}
