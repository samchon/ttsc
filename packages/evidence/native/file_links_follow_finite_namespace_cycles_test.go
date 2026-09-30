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
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check through the authored project-rule fixture exercises this case. Verifies finite citation paths can traverse cyclic module namespaces.
 *
 * @evidence contracts/testing.md#independent-expectations Every finite self/other/back path ends at the same authored value; repeated namespace hops must preserve clean Markdown and inline TypeScript coverage.
 *
 * @evidence contracts/testing.md#distinguishing-cases Export a self namespace and a namespace that returns through another module. Cite their repeated paths from Markdown and import-scoped TypeScript. Verify one unit remains one obligation through every address.
 *
 * @evidence contracts/testing.md#execution-ownership TestFileLinksFollowFiniteNamespaceCycles is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the authored project-rule fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
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
