import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestProject } from "../../../../utils/src/TestProject";
import { withCapturedTtscCacheCommand } from "../../internal/withCapturedTtscCacheCommand";

/**
 * Preserve the original native-denial population at the actual source handler.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual readdir must first deny the authored index with EACCES or EPERM; direct runTtsc then returns two and preserves the runtime tree without treating unreadability as absence.
 * @evidence contracts/testing.md#independent-expectations Host-enforced denial, literal nonzero failure and continued runtime existence define the fail-closed expectation; no errno-producing function is replaced.
 * @evidence contracts/testing.md#distinguishing-cases Windows and hosts whose actual chmod still permits listing retain the original false/skipped population. Denial, readable and missing indices are not conflated; this entry only owns denial, not synthetic platform capability.
 * @evidence contracts/testing.md#execution-ownership The direct source dispatcher receives owned filesystem input with synchronous restored stream/environment capture, without a test-created child, compiler or worker. Finally restores the index mode and reclaims the root, collecting cleanup failure; external CLI bootstrap and process exit are not exercised.
 */
export function test_runtime_clean_handler_refuses_a_denied_run_index():
  | void
  | false {
  if (process.platform === "win32") return false;
  const root = TestProject.physicalPath(
    TestProject.tmpdir("clean-handler-denial-"),
  );
  const runtime = path.join(root, "node_modules", ".cache", "ttsc", "ttsx");
  const runs = path.join(runtime, "project");
  TestProject.writeFiles(root, {
    "package.json":
      '{"name":"denied-index","private":true,"workspaces":["packages/*"]}',
    "tsconfig.json": '{"include":["src"]}',
    "src/main.ts": "export {};\n",
  });
  const failures: unknown[] = [];
  let unavailable = false;
  try {
    fs.mkdirSync(path.join(runs, "held"), { recursive: true });
    fs.chmodSync(runs, 0o000);
    try {
      fs.readdirSync(runs);
      unavailable = true;
    } catch (error) {
      assert.ok(
        ["EACCES", "EPERM"].includes(
          (error as NodeJS.ErrnoException).code ?? "",
        ),
      );
    }
    if (!unavailable) {
      const result = withCapturedTtscCacheCommand(root, [
        "clean",
        "--cwd",
        root,
      ]);
      try {
        assert.equal(result.status, 2, result.stdout);
      } catch (error) {
        failures.push(error);
      }
      try {
        assert.equal(fs.existsSync(runtime), true);
      } catch (error) {
        failures.push(error);
      }
    }
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      fs.chmodSync(runs, 0o755);
    } catch (error) {
      failures.push(error);
    }
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "Denied clean handler assertions failed",
    );
  if (unavailable) return false;
}
