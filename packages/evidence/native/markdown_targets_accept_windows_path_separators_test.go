package evidence

import "testing"

/**
 * Verifies Markdown declaration paths accept Windows separators without
 * normalizing unrelated TypeScript symbol names.
 *
 * Markdown units have canonical project-relative paths with slash separators,
 * but declarations are authored on both Windows and POSIX. Path portability is
 * therefore a Markdown resolution concern, not a global target rewrite.
 *
 *  1. Materialize one canonical Markdown heading target.
 *  2. Cite it from TypeScript with backslash path separators.
 *  3. Assert the declaration resolves and satisfies coverage.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies Markdown declaration paths accept Windows separators without normalizing unrelated TypeScript symbol names. The original assertions check assert the declaration resolves and satisfies coverage.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Markdown units have canonical project-relative paths with slash separators, but declarations are authored on both Windows and POSIX. Path portability is therefore a Markdown resolution concern, not a global target rewrite. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Materialize one canonical Markdown heading target. Cite it from TypeScript with backslash path separators. Assert the declaration resolves and satisfies coverage. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestMarkdownTargetsAcceptWindowsPathSeparators is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestMarkdownTargetsAcceptWindowsPathSeparators(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/ref.ts": `
/** @evidence docs\spec.md#contract This type adopts the portable document path. */
export interface Ref {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ref.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertNoProblems(t, messages)
}
