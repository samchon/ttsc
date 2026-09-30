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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification graphRule.Check through the authored project-rule fixture exercises this case. Verifies file links preserve literal member segments and encoded file paths.
 *
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Instance prototype.run, the static literal prototype.run, and static a/b are three distinct authored members despite similar display text and encoded file characters.
 *
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Define instance and static literal members in a file containing space/#. Cite each through a distinct file-qualified accessor. Verify every obligation is satisfied without ambiguity.
 *
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestFileLinksPreserveAccessorSegments is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the authored project-rule fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
 */
func TestFileLinksPreserveAccessorSegments(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/a # b.ts":   `export class Service { run(): void {} static "prototype.run"(): void {} static "a/b" = 1; }`,
    "docs/review.md": "## Review\n<!--\n@link ../src/a%20%23%20b.ts#Service.prototype.run Checks instance behavior.\n@link ..\\src\\a%20%23%20b.ts#Service[\"prototype.run\"] Checks the static literal.\n@link ../src/a%20%23%20b.ts#Service[\"a/b\"] Checks the literal field.\n-->\n",
  }, `{"claims":[{"type":"markdown","files":["docs/review.md"],"symbol":"h2","reference":{"type":"typescript","files":["src/**"],"symbol":["function","property"]}}]}`))
}
