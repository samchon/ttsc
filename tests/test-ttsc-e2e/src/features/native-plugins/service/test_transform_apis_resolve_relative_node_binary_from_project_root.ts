import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  TtscCompiler,
  TtscService,
} from "../../../../../../packages/ttsc/lib/index.js";
import { TestUtilityPlugins } from "../../../internal/TestUtilityPlugins";
import { tsgo } from "../../../internal/compiler";
import { SHARED_GO_BUILD_CACHE_DIR, SHARED_PLUGIN_CACHE_DIR } from "../../../internal/plugin-cache";

/**
 * Verifies transform API runtime overrides resolve against the actual project.
 *
 * Relative runtime overrides belong to the project process that consumes them.
 * The API caller may live elsewhere, but both one-shot and resident native
 * hosts spawn with the project root as cwd and must resolve TTSC_NODE_BINARY
 * against that same directory.
 *
 * 1. Copy a real Node executable into the project, with a separate caller cwd.
 * 2. Configure the banner to observe the runtime environment supplied by the host.
 * 3. Transform through both APIs and assert the resolved project executable path.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual one-shot and resident transform APIs use the project-relative Node executable even though API caller cwd is elsewhere; both emitted banners contain the resolved executable path.
 * @evidence contracts/testing.md#independent-expectations The copied real Node executable at an explicit project filename and distinct caller directory establish the correct absolute path independently; exact single-banner expectations observe the environment actually consumed by config evaluation.
 * @evidence contracts/testing.md#distinguishing-cases Owns caller cwd versus projectRoot precedence and relative runtime overrides through both one-shot and resident consumers; ordinary service requests use the default runtime instead.
 * @evidence contracts/testing.md#execution-ownership The matching named service export invokes public TtscCompiler and TtscService with the same actual project context in the Linux native batch.
 * @evidence contracts/e2e.md#necessary-boundary The JS APIs, native host subprocess cwd and executable config evaluator must agree on relative runtime resolution; direct environment construction cannot prove both native consumers use that runtime.
 * @evidence contracts/e2e.md#shared-execution Both APIs share the same consumer project and immutable banner producer through the batch plugin cache and Go objects; no cold-cache property is asserted, so a private producer rebuild is unnecessary.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The copied executable and caller/project directories are local fixtures; the environment override is passed explicitly rather than replacing ambient cwd or spawn, and finally disposes the resident child.
 * @evidence contracts/e2e.md#preserved-coverage Original success type, nonempty one-shot/resident outputs and both exact single-banner runtime-path assertions remain. Only the previously unobserved private native cache is replaced with content-addressed batch reuse.
 */
export async function test_transform_apis_resolve_relative_node_binary_from_project_root(): Promise<void> {
  const root = TestProject.physicalPath(
    TestProject.copyProject("ttsc-utility-plugins"),
  );
  const caller = TestProject.tmpdir("ttsc-relative-node-caller-");
  TestUtilityPlugins.seedPackages(root, ["banner"]);

  const tsconfig = JSON.parse(
    fs.readFileSync(path.join(root, "tsconfig.json"), "utf8"),
  ) as { compilerOptions: { plugins: unknown[] } };
  tsconfig.compilerOptions.plugins = [{ transform: "@ttsc/banner" }];
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify(tsconfig, null, 2),
    "utf8",
  );
  fs.rmSync(path.join(root, "banner.config.json"));
  fs.writeFileSync(
    path.join(root, "banner.config.cjs"),
    `module.exports = { text: process.env.TTSC_NODE_BINARY };\n`,
    "utf8",
  );

  const runtimeName =
    process.platform === "win32" ? "project-node.exe" : "project-node";
  const runtime = path.join(root, runtimeName);
  fs.copyFileSync(process.execPath, runtime);
  if (process.platform !== "win32") fs.chmodSync(runtime, 0o755);

  const context = {
    binary: tsgo,
    cwd: caller,
    env: {
      PATH: TestUtilityPlugins.goPath(),
      TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      TTSC_GO_CACHE_DIR: SHARED_GO_BUILD_CACHE_DIR,
      TTSC_NODE_BINARY: `.${path.sep}${runtimeName}`,
    },
    projectRoot: root,
    tsconfig: path.join(root, "tsconfig.json"),
  };

  const transformed = new TtscCompiler(context).transform();
  assert.equal(transformed.type, "success");
  const compilerOutput = transformed.typescript["src/main.ts"];
  assert.ok(compilerOutput, "one-shot transform returned no src/main.ts");
  TestUtilityPlugins.assertSingleBanner(compilerOutput, runtime);

  const service = new TtscService(context);
  try {
    const residentOutput = await service.transformFile("src/main.ts");
    assert.ok(residentOutput, "resident transform returned no src/main.ts");
    TestUtilityPlugins.assertSingleBanner(residentOutput, runtime);
  } finally {
    service.dispose();
  }
}
