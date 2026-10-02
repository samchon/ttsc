import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import { E2eProcessTrace } from "../../../../../../utils/src/E2eProcessTrace";
const { execFile } = E2eProcessTrace;
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

/**
 * Verifies a real Bun process closes each build's generation and gives the
 * runtime preload a session of its own.
 *
 * Bun's IPC, process lifetime, and loader ordering cannot be faithfully
 * stubbed, and a Windows broker child that kept Bun alive would only show up in
 * a real process. Each completed `Bun.build` must release its generation, and
 * the runtime preload must start a new one rather than reuse a build's.
 *
 * 1. Configure a plugin that logs each compile, and write a script that runs two
 *    `Bun.build` passes.
 * 2. Run it under Bun and assert both passes transform and each compiles once.
 * 3. Run a module under the `bun-register` preload and assert it is transformed by
 *    one more compile.
 *
 * @evidence contracts/testing.md#behavioral-verification Two real Bun.build passes each produce PLUGIN and total two compiles; separate preload process prints PLUGIN and raises count to three.
 * @evidence contracts/testing.md#independent-expectations Literal transformed output and fixture byte count establish build disposal and distinct runtime session.
 * @evidence contracts/testing.md#distinguishing-cases Repeated completed builds versus fresh preload runtime process.
 * @evidence contracts/testing.md#execution-ownership The test-e2e runner discovers test_bun_native_host_owns_build_and_runtime_sessions under unplugin/native-plugins/adapters. Its actual Bun --preload process owns public bun-register forwarding to the ambient runtime and transformed execution. Portable registration assertions execute at tests/test-unplugin/src/features/adapters/test_bun_register_preloads_the_runtime_transform_plugin.ts through source APIs.
 * @evidence contracts/e2e.md#necessary-boundary Actual Bun processes test IPC shutdown and preload ordering that captured setup cannot prove.
 * @evidence contracts/e2e.md#shared-execution One Bun process runs both builds; second preload process is required for independent runtime ownership. Native build artifacts can remain shared.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Child completion is awaited or collected synchronously; sessions and consumers have private tracked roots. Abrupt cancellation is not explicitly verified.
 * @evidence contracts/e2e.md#preserved-coverage Two real Bun.build passes still produce PLUGIN and total two compiles; a separate preload process still prints PLUGIN and raises the count to three, preserving actual public-entry-to-Bun forwarding. The five portable function/error/single-plugin/name/setup assertions formerly in the fake-global registration E2E execute at tests/test-unplugin/src/features/adapters/test_bun_register_preloads_the_runtime_transform_plugin.ts without modifying a foreign global.
 */
export async function test_bun_native_host_owns_build_and_runtime_sessions(): Promise<void> {
  const root = fs.realpathSync.native(TestUnpluginProject.createProject());
  const log = path.join(root, "dist", "compiles.bin");
  fs.mkdirSync(path.dirname(log), { recursive: true });
  const configuration = JSON.parse(
    fs.readFileSync(path.join(root, "tsconfig.json"), "utf8"),
  );
  configuration.compilerOptions.plugins.push({
    transform: "./plugin.cjs",
    name: "runs",
    operation: "count-runs",
    runLog: log,
  });
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify(configuration),
  );
  const library = path.dirname(TestUnpluginRuntime.libPath("bun", "mjs"));
  TestProject.writeFiles(root, {
    "build.mjs": [
      'import assert from "node:assert/strict";',
      `import ttsc from ${JSON.stringify(pathToFileURL(path.join(library, "bun.mjs")).href)};`,
      "const plugin = ttsc();",
      "for (let pass = 0; pass < 2; pass++) {",
      '  const result = await Bun.build({ entrypoints: ["./src/main.ts"], plugins: [plugin], target: "bun" });',
      '  assert.equal(result.success, true, result.logs.join("\\n"));',
      '  assert.match(await result.outputs[0].text(), /"PLUGIN"/);',
      "}",
    ].join("\n"),
    "runtime.mjs": 'import "./src/main.ts";',
  });
  const run = promisify(execFile);
  const binary = process.env.TTSC_BUN_BINARY ?? "bun";
  const options = {
    cwd: root,
    env: process.env,
    timeout: 120_000,
    windowsHide: true,
  };
  await run(binary, ["build.mjs"], options);
  assert.equal(
    fs.statSync(log).size,
    2,
    "each completed Bun build releases its generation",
  );
  const result = await run(
    binary,
    ["--preload", path.join(library, "bun-register.mjs"), "runtime.mjs"],
    options,
  );
  assert.equal(result.stdout.trim(), "PLUGIN");
  assert.equal(
    fs.statSync(log).size,
    3,
    "runtime preload owns a new immutable load session",
  );
}
