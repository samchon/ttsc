import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { E2eProcessTrace } from "../../../../../../utils/src/E2eProcessTrace";
import { FixtureFiles } from "../../../../internal/FixtureFiles";

/**
 * Verifies ttsx rescues a `.js` entry path back to its `.ts` source when a
 * program forks a child whose main module is named with a `.js` extension.
 *
 * Libraries like `tgrid` (used by `@nestia/benchmark`) fork a servant via
 * `child_process.fork(__dirname + "/servant.js")` — a `.js` path. Under
 * run-from-source `__dirname` is the source tree, which ships only the `.ts`,
 * so the child's main module would die with `Cannot find module servant.js`. A
 * tgrid master then waits on the dead child's handshake forever (the benchmark
 * CI job hung until the 60-minute timeout). The resolve hook must map the
 * absolute `.js` main entry — which reaches the hook with no `parentURL` — to
 * its `.ts` source.
 *
 * 1. Create a project whose entry forks `node child.js`, but only `child.ts`
 *    exists on disk.
 * 2. Assert the forked child started (its `.ts` was rescued and run) and the
 *    parent saw it exit cleanly.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual child_process.fork requests absent child.js while only child.ts exists; parent zero status and child:rescued-from-source show that the native main-entry resolver served the source.
 * @evidence contracts/testing.md#independent-expectations The literal child output and deliberately absent emitted spelling establish rescue independently of the resolver result.
 * @evidence contracts/testing.md#distinguishing-cases This owns parentless absolute main resolution under fork; direct worker inheritance and detached-lifetime cleanup are complementary entries.
 * @evidence contracts/testing.md#execution-ownership This named filename-matching E2E entry runs the real built launcher or public register and native host. Portable option/cache decisions stay in source units; recursive main24 and the explicit Node compatibility directory both select this actual boundary.
 * @evidence contracts/e2e.md#necessary-boundary Actual child_process.fork requests absent child.js while only child.ts exists; parent zero status and child:rescued-from-source show that the native main-entry resolver served the source. Direct source calls cannot prove this NativeNode loader or process connection.
 * @evidence contracts/e2e.md#shared-execution One root program is prepared once and its parent forks one child; distinct parent and child lifetimes are necessary for native fork main resolution.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fresh fixture has no child.js that could bypass rescue; the parent waits for child exit and propagates its status.
 * @evidence contracts/e2e.md#preserved-coverage All original meaningful status, output and state assertions remain in this named entry; physical directory selection removes only repeated unrelated portable cases from floor/current execution, while main24 retains the entire runtime population.
 */
export function test_ttsx_forks_a_child_whose_entry_path_is_javascript() {
  const root = TestProject.createProject(
    E2eProcessTrace.fixtureFiles(
      FixtureFiles.read(
        "ttsc/ttsx_forks_a_child_whose_entry_path_is_javascript/inputs-1",
      ),
    ),
  );

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/main.ts"],
    { cwd: root },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "child:rescued-from-source");
}
