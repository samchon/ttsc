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
 * @evidence contracts/testing.md#behavioral-verification newFileLinkFixture builds api/index.ts and api/b.ts re-exporting each other's bindings with links to `value` and `other`, which must be clean; after rerouting `value` through api/c.ts (which star-exports the index) the check must still be clean, and after c.ts is reduced to `export { value } from './index'` (a cycle with no declaration) the check must contain `no public export named 'value'`.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the export-resolution contract: a module visited while another name is being resolved is not empty, only real bindings contribute units, and a cycle that never reaches a declaration leaves the name missing.
 * @evidence contracts/testing.md#distinguishing-cases Three stages of one fixture: a mutual named cycle with real bindings, a star-forwarded cycle with a real binding, and a purely circular forwarding binding; only the last must fail.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksResolveNamedExportCycles is a Go unit entry in the native test process; it drives graphRule.Check through newFileLinkFixture over real temp files rewritten between stages, with no consumer install or product host.
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
