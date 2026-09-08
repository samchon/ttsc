package evidence

import "testing"

/**
 * Verifies an installed package's re-export reads declarations before JS emit.
 *
 * The package's files are absent from the Program, as promised by package
 * populations. Otherwise Program-first lookup would hide the disk resolver bug.
 *
 * 1. Install a declaration barrel beside its emitted JavaScript sibling.
 * 2. Supply only the citing TypeScript file to the Program.
 * 3. Verify its existing inline citation resolves to the package declaration.
 */
func TestPackageReexportsPreferDeclarationsToEmit(t *testing.T) {
  source := "import type { Target } from 'sdk';\n/** @evidence {@link Target.property} Reads the field. */\nexport interface Review {}"
  fixture := newFileLinkFixture(t, map[string]string{
    "node_modules/sdk/package.json": `{"name":"sdk","types":"index.d.ts"}`,
    "node_modules/sdk/index.d.ts":   `export { Target } from "./value.js";`,
    "node_modules/sdk/value.d.ts":   `export interface Target { property: number; }`,
    "node_modules/sdk/value.js":     `export {};`,
    "review.ts":                     source,
  }, `{"claims":[{"type":"typescript","files":["review.ts"],"symbol":"type","reference":{"type":"typescript","package":"sdk","symbol":"property"}}]}`)
  fixture.sources = append(fixture.sources, fixture.source("review.ts", source))
  assertNoProblems(t, fixture.check())
}
