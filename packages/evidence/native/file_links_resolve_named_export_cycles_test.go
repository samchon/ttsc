package evidence

import "testing"

/**
 * Verifies named binding cycles preserve real exports and reject missing ones.
 *
 * A module visited while another name is being resolved is not an empty
 * module. Cycle identity includes the requested name, and only real bindings
 * contribute units; a cycle that never reaches a declaration remains missing.
 *
 * 1. Select mutually re-exporting modules with local and forwarded bindings.
 * 2. Verify named and star forwarding close the value and other obligations.
 * 3. Remove a real binding and assert the incomplete cycle is diagnosed.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification graphRule.Check through the file-link fixture exercises this case. Verifies named binding cycles preserve real exports and reject missing ones.
 *
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Real value/other bindings survive named and star cycles; replacing the only real value with a circular forwarding binding must report no public value export.
 *
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Select mutually re-exporting modules with local and forwarded bindings. Verify named and star forwarding close the value and other obligations. Remove a real binding and assert the incomplete cycle is diagnosed.
 *
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestFileLinksResolveNamedExportCycles is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the file-link fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
 */
func TestFileLinksResolveNamedExportCycles(t *testing.T) {
  fixture := newFileLinkFixture(t, map[string]string{
    "api/index.ts": "export const value = 1; export { other } from './b';",
    "api/b.ts":     "export const other = 2; export { value } from './index';",
    "review.md":    "## Review\n<!-- @link api/index.ts#value Reads value.\n@link api/index.ts#other Reads other. -->\n",
  }, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"api","files":["index.ts"],"symbol":"property"}}]}`)
  assertNoProblems(t, fixture.check())
  fixture.write("api/index.ts", "export { value } from './c'; export { other } from './b';")
  fixture.write("api/c.ts", "export const value = 1; export * from './index';")
  assertNoProblems(t, fixture.check())
  fixture.write("api/c.ts", "export { value } from './index';")
  assertProblemContains(t, fixture.check(), "no public export named 'value'")
}
