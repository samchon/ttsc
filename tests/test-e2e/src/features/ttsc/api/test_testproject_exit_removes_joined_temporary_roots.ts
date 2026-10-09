import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { SidecarEnvironment } from "../../../../../../packages/ttsc/lib/compiler/internal/sharedHost/SidecarEnvironment.js";
import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";

const { spawnSync } = E2eProcessTrace;

/**
 * Verifies initial temp binding and exit removal of owned temporary roots.
 *
 * Exit listeners execute in the owning child process. Calling filesystem
 * cleanup directly cannot establish that the registered listener releases a
 * normal allocation after its reader finishes.
 *
 * 1. Start a real Node child with initial TEMP/TMP/TMPDIR bound to this fixture.
 * 2. Allocate and write default-parent and explicit-parent tracked roots.
 * 3. Join successful child exit and require both reported roots to be absent.
 *
 * @evidence contracts/testing.md#behavioral-verification A real child allocates and writes through TestProject.tmpdir using both its initial temp environment and an explicit parent, then normal exit must remove both directories. Parent assertions check reported parent paths, native physical parents, exit status and actual filesystem absence.
 * @evidence contracts/testing.md#independent-expectations The parent independently supplies the initial temp environment and explicit allocation parent. Both allocations must report that owned parent and its native physical identity; the normal tracked-allocation contract requires removal at process exit.
 * @evidence contracts/testing.md#distinguishing-cases Default-parent selection contrasts explicit-parent selection in the same child, preserving ordinary release for both roots. The companion retained-root entry checks deliberate unresolved-owner retention and invalid ownership requests.
 * @evidence contracts/testing.md#execution-ownership Focused lifecycle verification invokes this named API export directly, using an actual Node process rather than unit-hook substitution. Evidence selects the function, but the shared boundary DAG does not discover this legacy API feature file.
 * @evidence contracts/e2e.md#necessary-boundary Node process termination invokes the helper's exit listener; a direct unit call cannot observe that listener in an already exited process.
 * @evidence contracts/e2e.md#shared-execution Uses the current Node executable and authored helper without building Go, installing a consumer or preparing SDK artifacts. The existing single child owns both allocation paths and the same exit lifecycle.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The parent owns a unique outer root and supplies its initial environment through native-name writes to a child-local copy, preserving the caller's environment. Successful unsignalled synchronous child termination precedes removal of that exact fixture. Body and cleanup failures are both retained. No arbitrary descendant closure or forced-interruption cleanup is established; no shared source/cache is touched.
 * @evidence contracts/e2e.md#preserved-coverage The original explicit-parent lifecycle assertions retain successful unsignalled direct-child termination, validated basename, actual root absence and empty outer directory. Default-parent initial-environment binding adds a contrasting allocation in the same child. It replaces no compiler or SDK assertion; cleanup errors are retained alongside body failures.
 */
export const test_testproject_exit_removes_joined_temporary_roots = () => {
  const outer = TestProject.tmpdir("ttsc-exit-cleanup-normal-");
  const failures: unknown[] = [];
  try {
    const env = { ...process.env };
    for (const name of ["TEMP", "TMP", "TMPDIR"])
      SidecarEnvironment.write(env, name, outer);
    const helper = pathToFileURL(
      path.join(TestProject.TEST_PACKAGE_ROOT, "src", "TestProject.ts"),
    ).href;
    const child = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--import",
        pathToFileURL(
          path.join(
            TestProject.WORKSPACE_ROOT,
            "config",
            "register-typescript-loader.mjs",
          ),
        ).href,
        "--input-type=module",
        "-e",
        [
          "import fs from 'node:fs'; import path from 'node:path';",
          `const { TestProject } = await import(${JSON.stringify(helper)});`,
          `const roots = [TestProject.tmpdir('child-default-'), TestProject.tmpdir('child-', ${JSON.stringify(outer)})];`,
          "const observed = roots.map(root => { fs.writeFileSync(path.join(root, 'input.txt'), 'actual input'); return { root, physicalParent: fs.realpathSync.native(path.dirname(root)) }; });",
          "console.log(JSON.stringify(observed));",
        ].join("\n"),
      ],
      {
        cwd: TestProject.WORKSPACE_ROOT,
        env,
        encoding: "utf8",
        windowsHide: true,
      },
    );
    assert.ifError(child.error);
    assert.equal(child.signal, null);
    assert.equal(child.status, 0, child.stderr);
    const observed: unknown = JSON.parse(child.stdout.trim());
    assert.ok(Array.isArray(observed));
    assert.equal(observed.length, 2);
    for (const [index, allocated] of observed.entries()) {
      assert.ok(allocated !== null && typeof allocated === "object");
      assert.equal(typeof allocated.root, "string");
      assert.equal(path.dirname(allocated.root), outer);
      assert.equal(allocated.physicalParent, fs.realpathSync.native(outer));
      assert.match(path.basename(allocated.root), index === 0
        ? /^child-default-[A-Za-z0-9]+$/ : /^child-[A-Za-z0-9]+$/);
      assert.equal(fs.existsSync(allocated.root), false);
    }
    assert.deepEqual(fs.readdirSync(outer), []);
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      fs.rmSync(outer, { recursive: true, force: true });
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(failures, "TestProject exit fixture failed");
};
