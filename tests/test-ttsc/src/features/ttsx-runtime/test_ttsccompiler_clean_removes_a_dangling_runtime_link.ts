import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TtscCompiler } from "../../../../../packages/ttsc/src/TtscCompiler";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies default API cleanup removes a dangling runtime cache link.
 *
 * A terminal junction still exists when its target is gone. The safe cleanup
 * resolver recognizes it with lstat, but an existsSync precheck skipped the
 * runtime branch and left the link behind indefinitely.
 *
 * 1. Point a dedicated cache's runtime entry at a temporary directory.
 * 2. Remove the target so the junction is dangling.
 * 3. Clean through TtscCompiler and assert the link itself is removed.
 *
 * @evidence contracts/testing.md#behavioral-verification The authored TtscCompiler.clean API resolves and removes a dangling runtime link; lstat proves the initial link exists despite existsSync missing its target, and cleanup returns its path before lstat reports ENOENT.
 * @evidence contracts/testing.md#independent-expectations Node native lstat observes the link itself whereas existsSync follows its target; default cleanup must remove an owned dangling cache entry rather than treating it as absent.
 * @evidence contracts/testing.md#distinguishing-cases A directory link is first valid, then made dangling by removing only its target; the returned cleanup path and absent terminal link independently detect skipping the dangling entry. A live link, a link with owned runs and a non-link runtime directory are not covered.
 * @evidence contracts/testing.md#execution-ownership This named source-unit entry imports the authored compiler API and invokes only cleanup over a temporary fixture. No compiler build, consumer install or product host runs; native directory-link input exercises the resolver directly. Missing cleanup candidates can cause the shared identity resolver to query Windows case policy through read-only fsutil, not a compiler or runtime host.
 */
export function test_ttsccompiler_clean_removes_a_dangling_runtime_link(): void {
  const root = TestProject.tmpdir("ttsc-dangling-runtime-");
  const project = path.join(root, "project");
  const cache = path.join(root, "cache", "ttsc");
  const runtime = path.join(cache, "ttsx");
  const target = path.join(root, "target");
  TestProject.writeFiles(project, {
    "package.json": JSON.stringify({ private: true }),
    "tsconfig.json": JSON.stringify({ include: ["src"] }),
    "src/main.ts": "export const value = 1;\n",
  });
  fs.mkdirSync(cache, { recursive: true });
  fs.mkdirSync(target);
  fs.symlinkSync(
    target,
    runtime,
    process.platform === "win32" ? "junction" : "dir",
  );
  fs.rmdirSync(target);
  assert.equal(fs.existsSync(runtime), false);
  assert.equal(fs.lstatSync(runtime).isSymbolicLink(), true);

  const removed = new TtscCompiler({
    cwd: project,
    env: { TTSC_CACHE_DIR: cache },
  }).clean();
  assert.ok(removed.some((directory) => path.resolve(directory) === runtime));
  assert.throws(
    () => fs.lstatSync(runtime),
    (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT",
  );
}
