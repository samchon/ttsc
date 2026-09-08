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
 */
func TestFileLinksPreserveInlineLiteralTargets(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{"target.ts": `export class A { static "ts#key" = 1; }`, "review.ts": "import type { A } from './target';\n/** @evidence {@link A.ts#key} Reads the field. */\nexport interface Review {}"}, `{"claims":[{"type":"typescript","files":["review.ts"],"symbol":"type","reference":{"type":"typescript","files":["target.ts"],"symbol":"property"}}]}`))
}
