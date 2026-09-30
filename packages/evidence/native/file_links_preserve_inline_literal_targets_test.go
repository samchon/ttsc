package evidence

import "testing"

/**
 * Verifies file-link parsing cannot consume an existing inline literal target.
 *
 * A literal member can contain '.ts#' without being a file address. The inline
 * braces choose the import resolver before the body can resemble a filename.
 *
 * 1. Export a member whose literal name contains the file-address delimiter.
 * 2. Cite it with the existing import-scoped inline syntax.
 * 3. Verify the new parser preserves its successful resolution.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check through the authored project-rule fixture exercises this case. Verifies file-link parsing cannot consume an existing inline literal target.
 *
 * @evidence contracts/testing.md#independent-expectations Inline braces and the imported A scope identify the static ts#key literal; the delimiter inside a member is not a file address.
 *
 * @evidence contracts/testing.md#distinguishing-cases Export a member whose literal name contains the file-address delimiter. Cite it with the existing import-scoped inline syntax. Verify the new parser preserves its successful resolution.
 *
 * @evidence contracts/testing.md#execution-ownership TestFileLinksPreserveInlineLiteralTargets is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the authored project-rule fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
 */
func TestFileLinksPreserveInlineLiteralTargets(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{"target.ts": `export class A { static "ts#key" = 1; }`, "review.ts": "import type { A } from './target';\n/** @evidence {@link A.ts#key} Reads the field. */\nexport interface Review {}"}, `{"claims":[{"type":"typescript","files":["review.ts"],"symbol":"type","reference":{"type":"typescript","files":["target.ts"],"symbol":"property"}}]}`))
}
