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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule over target.ts (`export class A { static "ts#key" = 1; }`) and a review.ts citing `{@link A.ts#key}` through `import type { A }`, with a TypeScript property reference; assertNoProblems requires an empty list.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the grammar contract: the braces choose the import-scoped inline resolver, so the `.ts#` inside a member name is part of the literal key and must not be parsed as a file address.
 * @evidence contracts/testing.md#distinguishing-cases One literal member name containing the file-address delimiter cited through inline syntax; the file-qualified syntax with literal members is owned by the accessor-segments entry.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksPreserveInlineLiteralTargets is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestFileLinksPreserveInlineLiteralTargets(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{"target.ts": `export class A { static "ts#key" = 1; }`, "review.ts": "import type { A } from './target';\n/** @evidence {@link A.ts#key} Reads the field. */\nexport interface Review {}"}, `{"claims":[{"type":"typescript","files":["review.ts"],"symbol":"type","reference":{"type":"typescript","files":["target.ts"],"symbol":"property"}}]}`))
}
