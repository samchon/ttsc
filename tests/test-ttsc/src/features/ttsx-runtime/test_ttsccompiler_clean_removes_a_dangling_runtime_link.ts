import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TtscCompiler } from "../../../../../packages/ttsc/lib/index.js";

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
 */
export const test_ttsccompiler_clean_removes_a_dangling_runtime_link =
  (): void => {
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
  };
