package evidence

import "testing"

/**
 * Verifies named exports shadow stars while unresolved star ambiguity survives.
 *
 * A barrel cannot manufacture a winning binding by forwarding an ambiguous
 * name, and an explicit export must not compete with a star it overrides.
 *
 * 1. Combine two same-named declarations through stars and a named re-export.
 * 2. Verify a forwarding barrel reports the ambiguity.
 * 3. Select one binding explicitly and verify the same citation resolves.
 *
 * @evidence contracts/testing.md#behavioral-verification newFileLinkFixture builds two modules exporting `value` combined by `export * from './a'; export * from './b'` in a middle barrel that index.ts forwards, with a link `api/index.ts#value`; the first check must contain `Ambiguous file-qualified`, and after the middle barrel is rewritten to `export * from './a'; export { value } from './b';` the check must be clean.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the export-resolution rule: two star exports of one name are ambiguous and a forwarding barrel cannot manufacture a winner, while an explicit named export shadows a star it competes with.
 * @evidence contracts/testing.md#distinguishing-cases The same link and files before and after replacing one star with a named export: only the shadowing differs, so the first run must be ambiguous and the second resolved.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksPreserveExportShadowingAndAmbiguity is a Go unit entry in the native test process; it drives graphRule.Check through newFileLinkFixture over real temp files, with no consumer install or product host.
 */
func TestFileLinksPreserveExportShadowingAndAmbiguity(t *testing.T) {
  fixture := newFileLinkFixture(t, map[string]string{"api/a.ts": "export const value = 1;", "api/b.ts": "export const value = 2;", "api/middle.ts": "export * from './a'; export * from './b';", "api/index.ts": "export { value } from './middle';", "review.md": "## Review\n<!-- @link api/index.ts#value Reads the value. -->\n"}, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"api","files":["index.ts"],"symbol":"property"}}]}`)
  assertProblemContains(t, fixture.check(), "Ambiguous file-qualified")
  fixture.write("api/middle.ts", "export * from './a'; export { value } from './b';")
  assertNoProblems(t, fixture.check())
}
