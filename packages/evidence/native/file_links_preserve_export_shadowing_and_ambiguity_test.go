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
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check through the file-link fixture exercises this case. Verifies named exports shadow stars while unresolved star ambiguity survives.
 *
 * @evidence contracts/testing.md#independent-expectations Two star exports bind distinct values and remain ambiguous; replacing one star with the explicit value export shadows the competitor and permits the same citation.
 *
 * @evidence contracts/testing.md#distinguishing-cases Combine two same-named declarations through stars and a named re-export. Verify a forwarding barrel reports the ambiguity. Select one binding explicitly and verify the same citation resolves.
 *
 * @evidence contracts/testing.md#execution-ownership TestFileLinksPreserveExportShadowingAndAmbiguity is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the file-link fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
 */
func TestFileLinksPreserveExportShadowingAndAmbiguity(t *testing.T) {
  fixture := newFileLinkFixture(t, map[string]string{"api/a.ts": "export const value = 1;", "api/b.ts": "export const value = 2;", "api/middle.ts": "export * from './a'; export * from './b';", "api/index.ts": "export { value } from './middle';", "review.md": "## Review\n<!-- @link api/index.ts#value Reads the value. -->\n"}, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"api","files":["index.ts"],"symbol":"property"}}]}`)
  assertProblemContains(t, fixture.check(), "Ambiguous file-qualified")
  fixture.write("api/middle.ts", "export * from './a'; export { value } from './b';")
  assertNoProblems(t, fixture.check())
}
