import { TestProject, TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";
const { execFileSync } = E2eProcessTrace;
import fs from "node:fs";
import path from "node:path";

import { MetroWorkspace } from "../../../internal/metro/internal/MetroWorkspace";
import { TestMetroRuntime } from "../../../internal/metro/internal/metro-runtime";

/**
 * Verifies Metro's transform workers compile a project once between them
 * (samchon/ttsc#1390).
 *
 * Metro forks one worker per CPU from the process that evaluated its config,
 * and each worker compiled the whole project before transforming its first
 * file. `withTtsc` now opens a transform session in that process, the workers
 * inherit it, and they share each compile through it.
 *
 * The session's store outlives every process and belongs to the user
 * (samchon/ttsc#1483), so the config process runs under a temporary directory
 * of the test's own, never the user's, which the runner removes when it exits.
 *
 * 1. In a config process with a temporary directory of its own, call `withTtsc`,
 *    then fork two workers that transform the entry through the built
 *    transformer at the same time.
 * 2. Assert both received the plugin-transformed source from one compile.
 *
 * @evidence contracts/testing.md#behavioral-verification The real built config forks two actual worker processes; both receive native plugin output and their shared compile log is exactly one byte.
 * @evidence contracts/testing.md#independent-expectations The count-runs plugin appends one byte per actual compile; literal two outputs and the independent log width distinguish shared compilation from two correct but redundant builds.
 * @evidence contracts/testing.md#distinguishing-cases Concurrent workers with one inherited session contrast ordinary single-worker transforms; each worker output is validated, not just the aggregate count.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_metro, which is discovered under src/features and selected by the E2E Evidence claim; this exported scenario executes the built adapter and actual producer and process connection, and its body retains every named assertion.
 * @evidence contracts/e2e.md#necessary-boundary Separate process workers must inherit and consume a shared transform session; an in-process cache test cannot prove that transport and contention connection.
 * @evidence contracts/e2e.md#shared-execution One config process opens one session and forks exactly two workers concurrently for one project/native plugin generation. Both reuse the suite immutable source/build cache; separate processes are required to exercise cross-worker sharing. Its project is a slot of the experiment's single workspace, written or copied by MetroWorkspace instead of being created as a separate temporary directory.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The runLog belongs only to this project. Entering the slot replaces it, which removes any earlier snapshot, epoch and recorded input, and the experiment removes the whole workspace and verifies its absence once, after the last scenario.
 * @evidence contracts/e2e.md#preserved-coverage Original two-output, per-output plugin marker and one-compile-byte assertions remain. Portable cache reuse and admission source tests cannot replace this actual concurrency boundary.
 */
export async function case_metro_transformer_workers_share_one_compile_per_session(
  workspace: MetroWorkspace.IWorkspace,
): Promise<void> {
    const root = MetroWorkspace.enterProject(workspace);
    const runLog = path.join(root, "compiles.bin");
    const tsconfig = path.join(root, "tsconfig.json");
    const config = JSON.parse(fs.readFileSync(tsconfig, "utf8"));
    config.compilerOptions.plugins = [
      { transform: "./plugin.cjs", name: "fixture", operation: "go-uppercase" },
      {
        transform: "./plugin.cjs",
        name: "runs",
        operation: "count-runs",
        runLog,
      },
    ];
    fs.writeFileSync(tsconfig, JSON.stringify(config, null, 2), "utf8");

    const worker = [
      `const transformer = await import(${JSON.stringify(TestMetroRuntime.libUrl("transformer"))});`,
      "const [src, projectRoot] = JSON.parse(process.argv[1]);",
      'const result = await transformer.transform({ src, filename: "src/main.ts", options: { projectRoot } });',
      "process.stdout.write(result.ast.src);",
    ].join("\n");
    const metro = [
      `const { withTtsc } = await import(${JSON.stringify(TestMetroRuntime.libUrl("index"))});`,
      `const { execFile } = (await import("node:module")).createRequire(import.meta.url)(${JSON.stringify(E2eProcessTrace.runtimePath)});`,
      "const [worker, src, projectRoot, upstream] = JSON.parse(process.argv[1]);",
      "withTtsc({ projectRoot }, { upstreamTransformer: upstream });",
      'const run = () => new Promise((resolve, reject) => execFile(process.execPath, ["--input-type=module", "-e", worker, JSON.stringify([src, projectRoot])], (error, stdout, stderr) => (error ? reject(new Error(stderr)) : resolve(stdout))));',
      "process.stdout.write(JSON.stringify(await Promise.all([run(), run()])));",
    ].join("\n");
    const outputs = JSON.parse(
      execFileSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          metro,
          JSON.stringify([
            worker,
            TestUnpluginProject.mainSource(root),
            root,
            TestMetroRuntime.fakeUpstreamPathOnDisk(),
          ]),
        ],
        {
          cwd: root,
          env: { ...process.env, ...isolatedTemporaryDirectory() },
          windowsHide: true,
        },
      ).toString(),
    ) as string[];

    assert.equal(outputs.length, 2);
    for (const output of outputs) {
      TestUnpluginProject.assertTransformedToPlugin(output);
    }
    assert.equal(fs.statSync(runLog).size, 1, "the workers compiled once");
  };

/**
 * `TEMP`, `TMP`, and `TMPDIR`, the variables `os.tmpdir()` reads on every
 * platform, naming one tracked temporary directory, with no session inherited.
 */
function isolatedTemporaryDirectory(): NodeJS.ProcessEnv {
  const directory = TestProject.tmpdir("ttsc-metro-worker-session-");
  return {
    TEMP: directory,
    TMP: directory,
    TMPDIR: directory,
    TTSC_UNPLUGIN_TRANSFORM_SESSION: "",
  }

}
