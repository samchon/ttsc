import { TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import { E2eProcessTrace } from "../../../../../../utils/src/E2eProcessTrace";
const { spawn } = E2eProcessTrace;
import fs from "node:fs";

import { createCacheProject } from "../../../../internal/unplugin/internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../../../internal/unplugin/internal/transform-project-cache/projectModules";

/**
 * Verifies Turbopack's loader workers share each compile through the session
 * they inherit (samchon/ttsc#1390).
 *
 * `next build --turbopack` ran the loader in five processes for a 61-module
 * app, and each compiled the whole project. The loader module declares its
 * cache shared with the session named in its environment, which `withTtsc`
 * opens before Turbopack forks the workers.
 *
 * 1. Run the built loader in two processes at once, one module each, with a
 *    session in their environment.
 * 2. Assert both modules are transformed by one compile.
 *
 * @evidence contracts/testing.md#behavioral-verification Two concurrent Node workers return PROBED for different modules while the native run log grows by one byte.
 * @evidence contracts/testing.md#independent-expectations Fixture probe marker and compile counter independently distinguish shared compilation from two correct separate outputs.
 * @evidence contracts/testing.md#distinguishing-cases Two workers, two modules and one inherited session.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_turbopack_loader_workers_share_one_compile is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-e2e start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Actual process environment and session transport coordinate built loader workers.
 * @evidence contracts/e2e.md#shared-execution Two concurrent worker processes share one fresh session, project and native result; separate workers are the coordination boundary. The shared family borrows the completed Vite project's unchanged two remaining module bytes and restored descriptor, preserving the two-module input while retaining surplus bytes outside the include root.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Standalone preparation has two original modules. Shared preparation follows successful Vite hook closure, exact descriptor restoration and retention of the other two modules outside src. A fresh inherited session separates the worker generation, and the actual preceding native log length supplies the interval baseline. Both worker promises settle before verdict collection; error and close are distinct and a close deadline is unresolved ownership, not successful termination or descendant join.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: two concurrent Node workers return PROBED for different modules while the native run log grows by one byte, with standalone baseline zero. Original script, built loader and inherited session remain. No portable assertion is transferred or waived; close timeout is not coverage success and actual survival remains unverified.
 */
export async function test_turbopack_loader_workers_share_one_compile(
  prepared?: { root: string; runLog: string },
): Promise<void> {
  const project = prepared ?? createCacheProject({ fileCount: 2 });
  const files = projectModules(project.root);
  assert.equal(files.length, 2, "the original worker population has two modules");
  const baseline = fs.existsSync(project.runLog) ? fs.statSync(project.runLog).size : 0;
  const session = TestProject.tmpdir("ttsc-unplugin-turbopack-session-");
  const worker = (file: string) => {
    const script = [
      `const loader = (await import(${JSON.stringify(TestUnpluginRuntime.libUrl("turbopack"))})).default;`,
      'const fs = await import("node:fs");',
      "const file = process.argv[1];",
      "const content = await new Promise((resolve, reject) => loader.call({",
      "  async: () => (error, content) => (error ? reject(error) : resolve(content)),",
      "  getOptions: () => ({}),",
      "  resourcePath: file,",
      '}, fs.readFileSync(file, "utf8")));',
      "process.stdout.write(content);",
    ].join("\n");
    return new Promise<string>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ["--input-type=module", "-e", script, file],
        {
          env: {
            ...process.env,
            TTSC_UNPLUGIN_TRANSFORM_SESSION: session,
          },
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
          timeout: 120_000,
        },
      );
      let stdout = "";
      let stderr = "";
      let workerError: unknown;
      const closeDeadline = setTimeout(() => {
        reject(new AggregateError(workerError === undefined ? [] : [workerError], "Turbopack worker close was not joined after its timeout"));
      }, 121_000);
      child.stdout.on("data", (chunk) => (stdout += chunk));
      child.stderr.on("data", (chunk) => (stderr += chunk));
      child.once("error", (error) => { workerError = error; });
      child.once("close", (status, signal) => {
        clearTimeout(closeDeadline);
        if (workerError !== undefined) reject(workerError);
        else if (status === 0 && signal === null) resolve(stdout);
        else reject(new Error(`worker status=${status} signal=${signal}: ${stderr}`));
      });
    });
  };

  const outcomes = await Promise.allSettled(files.map(worker));
  const failures: unknown[] = [];
  for (const outcome of outcomes) {
    if (outcome.status === "rejected") failures.push(outcome.reason);
    else {
      try { assert.match(outcome.value, /PROBED/); }
      catch (cause) { failures.push(cause); }
    }
  }
  if (failures.length) throw new AggregateError(failures, "concurrent Turbopack worker outcomes");
  assert.equal(
    fs.statSync(project.runLog).size - baseline,
    1,
    "the workers compiled once",
  );
}
