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
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check through the authored project-rule fixture exercises this case. Verifies file-qualified addresses follow aliased default classes and anonymous functions.
 *
 * @evidence contracts/testing.md#independent-expectations Each named or anonymous default class reaches Public.property through the authored alias, and an anonymous default function remains addressable as default.
 *
 * @evidence contracts/testing.md#distinguishing-cases Export four default class declaration forms through a named Public barrel alias. Cite its public addresses with file links. Verify all selected units are acknowledged once.
 *
 * @evidence contracts/testing.md#execution-ownership TestFileLinksFollowExportAliases is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the authored project-rule fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
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
