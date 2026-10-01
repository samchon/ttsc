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
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule over src/a # b.ts (a class `Service` with an instance method `run`, a static method named `prototype.run` and a static `a/b` field) and a review.md holding three percent-encoded `@link`s to `Service.prototype.run`, `Service["prototype.run"]` and `Service["a/b"]`, under a property-and-function reference; assertNoProblems requires an empty list.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the addressing contract: the instance method, the static literal named `prototype.run` and the literal `a/b` field are three distinct members with similar display text, and decoding the encoded file path (space and `#`) must not rewrite any literal segment.
 * @evidence contracts/testing.md#distinguishing-cases The instance `prototype.run` and the static literal `prototype.run` share a readable spelling, so a resolver that merged them would leave one obligation owed; a clean graph shows each link acknowledged its own unit.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksPreserveAccessorSegments is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestFileLinksPreserveAccessorSegments(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/a # b.ts":   `export class Service { run(): void {} static "prototype.run"(): void {} static "a/b" = 1; }`,
    "docs/review.md": "## Review\n<!--\n@link ../src/a%20%23%20b.ts#Service.prototype.run Checks instance behavior.\n@link ..\\src\\a%20%23%20b.ts#Service[\"prototype.run\"] Checks the static literal.\n@link ../src/a%20%23%20b.ts#Service[\"a/b\"] Checks the literal field.\n-->\n",
  }, `{"claims":[{"type":"markdown","files":["docs/review.md"],"symbol":"h2","reference":{"type":"typescript","files":["src/**"],"symbol":["function","property"]}}]}`))
}
