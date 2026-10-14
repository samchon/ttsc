import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { workerModuleUrl } from "../../../../../packages/ttsc/src/internal/workerModuleUrl";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies worker module URLs retain native CommonJS entry resolution.
 *
 * Native filenames can contain characters with URL and JavaScript meanings.
 * Module loading must preserve those names, relative dependencies and
 * failures.
 *
 * 1. Load successful CommonJS entries through their worker module URLs.
 * 2. Reach relative dependencies below paths containing reserved characters.
 * 3. Preserve thrown values, source stacks and missing-entry rejection.
 *
 * @evidence contracts/testing.md#behavioral-verification Imports the production bootstrap URLs with Node's module loader, verifies execution through independently authored thrown markers and requires missing and successful entries to retain their actual outcomes.
 * @evidence contracts/testing.md#independent-expectations Authored CommonJS modules and dependencies define success or exact failure markers; these outcomes are unrelated to the URL representation. The Error stack must still name its authored source file and native CommonJS resolution defines MODULE_NOT_FOUND.
 * @evidence contracts/testing.md#distinguishing-cases Covers successful and throwing CommonJS entries, relative dependencies, spaces, apostrophes, percent and hash delimiters, Unicode filenames, a native backslash spelling and an absent entry. The backslash is a Windows separator and a literal POSIX filename character. Actual thread startup and inherited CLI options belong to integrated worker acceptance.
 * @evidence contracts/testing.md#execution-ownership The test-ttsc feature runner discovers this portable unit, which imports production-generated module URLs on the current thread and creates no process, worker, native artifact or consumer installation. Finally removes its private authored modules.
 */
export async function test_worker_module_url_preserves_native_entry_loading(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-worker-module-url-");
  try {
    const directory = path.join(root, "modules #100% ' \uD55C\uAE00\\native");
    fs.mkdirSync(directory, { recursive: true });
    const success = path.join(directory, "success.cjs");
    fs.writeFileSync(success, "module.exports = 42;");
    await import(workerModuleUrl(success).href);

    const marker = "reached relative CommonJS dependency";
    const dependency = path.join(directory, "dependency.cjs");
    const entry = path.join(directory, "entry #100% ' \uD55C\uAE00.cjs");
    fs.writeFileSync(dependency, `throw ${JSON.stringify(marker)};`);
    fs.writeFileSync(entry, "require('./dependency.cjs');");
    await assert.rejects(
      import(workerModuleUrl(entry).href),
      (error: unknown) => error === marker,
    );

    const failure = path.join(directory, "source-failure.cjs");
    fs.writeFileSync(
      failure,
      'throw new Error("authored worker entry failed");',
    );
    await assert.rejects(
      import(workerModuleUrl(failure).href),
      (error: unknown) =>
        error instanceof Error &&
        error.message === "authored worker entry failed" &&
        error.stack?.includes("source-failure.cjs") === true,
    );
    await assert.rejects(
      import(workerModuleUrl(path.join(directory, "missing.cjs")).href),
      (error: unknown) =>
        error instanceof Error &&
        (error as NodeJS.ErrnoException).code === "MODULE_NOT_FOUND",
    );
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
}
