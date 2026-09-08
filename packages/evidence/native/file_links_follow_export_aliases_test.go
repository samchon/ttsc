package evidence

import "testing"

/**
 * Verifies file-qualified addresses follow aliases, defaults, and type exports.
 *
 * A barrel publishes addresses but owns no extra declaration. Reaching a
 * default by its alias must not double the denominator or lose class members.
 *
 * 1. Export default declarations and a namespace alias through a barrel.
 * 2. Cite its public addresses with file links.
 * 3. Verify all selected units are acknowledged once.
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
