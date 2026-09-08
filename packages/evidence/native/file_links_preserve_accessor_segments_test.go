package evidence

import "testing"

/**
 * Verifies file links preserve literal member segments and encoded file paths.
 *
 * A dotted literal and a prototype path have the same human-readable legacy
 * address but are different obligations. Decoding file separators must not
 * rewrite either literal segment.
 *
 * 1. Define instance and static literal members in a file containing space/#.
 * 2. Cite each through a distinct file-qualified accessor.
 * 3. Verify every obligation is satisfied without ambiguity.
 */
func TestFileLinksPreserveAccessorSegments(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/a # b.ts":   `export class Service { run(): void {} static "prototype.run"(): void {} static "a/b" = 1; }`,
    "docs/review.md": "## Review\n<!--\n@link ../src/a%20%23%20b.ts#Service.prototype.run Checks instance behavior.\n@link ..\\src\\a%20%23%20b.ts#Service[\"prototype.run\"] Checks the static literal.\n@link ../src/a%20%23%20b.ts#Service[\"a/b\"] Checks the literal field.\n-->\n",
  }, `{"claims":[{"type":"markdown","files":["docs/review.md"],"symbol":"h2","reference":{"type":"typescript","files":["src/**"],"symbol":["function","property"]}}]}`))
}
