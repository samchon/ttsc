import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";
const { spawnSync } = E2eProcessTrace;
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Verifies process exit removes an ordinary tracked temporary root.
 *
 * Exit listeners execute in the owning child process. Calling filesystem
 * cleanup directly cannot establish that the registered listener releases a
 * normal allocation after its reader finishes.
 *
 * 1. Start a real Node child with the authored TestProject helper.
 * 2. Allocate and write one tracked root below the parent's owned fixture.
 * 3. Join successful child exit and require that root to be absent.
 *
 * @evidence contracts/testing.md#behavioral-verification A real child allocates and writes through TestProject.tmpdir, then normal exit must remove its directory; parent assertions check exit status and actual filesystem absence.
 * @evidence contracts/testing.md#independent-expectations A normal tracked allocation's contract requires removal at process exit; the parent owns the supplied directory and obtains the allocated basename from the actual child.
 * @evidence contracts/testing.md#distinguishing-cases This entry checks the ordinary release path. The companion retained-root entry checks deliberate unresolved-owner retention and invalid ownership requests.
 * @evidence contracts/testing.md#execution-ownership The named features/api function is selected by the E2E glob and the existing ttsc-core boundary runner, using an actual Node process rather than unit-hook substitution.
 * @evidence contracts/e2e.md#necessary-boundary Node process termination invokes the helper's exit listener; a direct unit call cannot observe that listener in an already exited process.
 * @evidence contracts/e2e.md#shared-execution Uses the current Node executable and authored helper without building Go, installing a consumer or preparing SDK artifacts. One child is required for this exit lifecycle.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The parent owns a unique outer root and observes successful unsignalled synchronous child termination before removing that exact fixture. Body and cleanup failures are both retained. No arbitrary descendant closure or forced-interruption cleanup is established; no shared source/cache is touched.
 * @evidence contracts/e2e.md#preserved-coverage This original lifecycle assertion retains successful unsignalled direct-child termination, validated basename, actual root absence and empty outer directory. It replaces no compiler or SDK assertion; cleanup errors are retained alongside body failures.
 */
export const test_testproject_exit_removes_joined_temporary_roots = () => {
  const outer = TestProject.tmpdir("ttsc-exit-cleanup-normal-");
  const failures: unknown[] = [];
  try {
    const helper = pathToFileURL(path.join(TestProject.TEST_PACKAGE_ROOT,
      "src", "TestProject.ts")).href;
    const child = spawnSync(process.execPath, ["--experimental-strip-types",
      "--import", pathToFileURL(path.join(TestProject.WORKSPACE_ROOT,
        "config", "register-typescript-loader.mjs")).href,
      "--input-type=module", "-e", [
        "import fs from 'node:fs'; import path from 'node:path';",
        `const { TestProject } = await import(${JSON.stringify(helper)});`,
        `const root = TestProject.tmpdir('child-', ${JSON.stringify(outer)});`,
        "fs.writeFileSync(path.join(root, 'input.txt'), 'actual input');",
        "console.log(JSON.stringify(path.basename(root)));",
      ].join("\n")], { cwd: TestProject.WORKSPACE_ROOT, encoding: "utf8",
      timeout: 30_000, windowsHide: true });
    assert.ifError(child.error);
    assert.equal(child.signal, null);
    assert.equal(child.status, 0, child.stderr);
    const basename: unknown = JSON.parse(child.stdout.trim());
    assert.equal(typeof basename, "string");
    assert.match(basename as string, /^child-[A-Za-z0-9]+$/);
    assert.equal(fs.existsSync(path.join(outer, basename as string)), false);
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
