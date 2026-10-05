import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  TtscCompiler,
  TtscService,
} from "../../../../../../../packages/ttsc/lib/index.js";
import { ProjectFixtures } from "../../../../internal/ttsc/internal/ProjectFixtures";
import { TestUtilityPlugins } from "../../../../internal/ttsc/internal/TestUtilityPlugins";
import { tsgo } from "../../../../internal/ttsc/internal/compiler";
import {
  SHARED_GO_BUILD_CACHE_DIR,
  SHARED_PLUGIN_CACHE_DIR,
} from "../../../../internal/ttsc/internal/plugin-cache";

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
 * @evidence contracts/testing.md#behavioral-verification Actual one-shot and resident APIs transform despite distinct caller cwd; both emitted banners contain the expected project-relative runtime override resolved to its absolute path. Banner text alone does not certify which executable image ran.
 * @evidence contracts/testing.md#independent-expectations The copied real Node executable at an explicit project filename and distinct caller directory establish the correct absolute path independently; exact single-banner expectations observe the environment actually consumed by config evaluation.
 * @evidence contracts/testing.md#distinguishing-cases Owns caller cwd versus projectRoot precedence and relative runtime overrides through both one-shot and resident consumers; ordinary service requests use the default runtime instead.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this named generic service entry; it invokes built workspace TtscCompiler and TtscService against the same actual project context. One-shot and resident calls are separate native connections.
 * @evidence contracts/e2e.md#necessary-boundary Real JS/native/config-evaluator connections must deliver the resolved override to both consumers; direct environment construction cannot prove either actual emitted banner. These observations establish delivered path text, not executable-byte or loaded-image equality.
 * @evidence contracts/e2e.md#shared-execution Both APIs share authored project/banner inputs and explicit suite plugin/Go caches. Cache availability does not certify hits, avoided rebuilds, one native process or identical Program objects between one-shot and resident consumers.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Copied runtime/caller/project and explicit overrides are private, without replacing ambient cwd or spawn. Supported void disposal is attempted and its errors are preserved with body errors, but it offers no awaited close acknowledgement. Tracked roots and already-owned plugin cache are conservatively retained before preparation until actual owned-spawn join evidence exists; retention is not closure certification.
 * @evidence contracts/e2e.md#preserved-coverage Original success type, nonempty one-shot/resident outputs and both exact single-banner runtime-path assertions remain, including the real copied Node and distinct caller cwd. Actual resident close/producer identity/population proof remain separate survival obligations; no original donor removal is authorized.
 */
export async function test_transform_apis_resolve_relative_node_binary_from_project_root(): Promise<void> {
  const root = TestProject.physicalPath(
    ProjectFixtures.copy("ttsc-utility-plugins"),
  );
  const caller = TestProject.tmpdir("ttsc-relative-node-caller-");
  const retentionReason =
    "relative-runtime service has no awaited disposal acknowledgement";
  TestProject.retainTemporaryDirectory(root, retentionReason);
  TestProject.retainTemporaryDirectory(caller, retentionReason);
  TestProject.retainSharedPluginCache(retentionReason);
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
  const failures: unknown[] = [];
  try {
    const residentOutput = await service.transformFile("src/main.ts");
    assert.ok(residentOutput, "resident transform returned no src/main.ts");
    TestUtilityPlugins.assertSingleBanner(residentOutput, runtime);
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      service.dispose();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "relative-runtime resident transformation or disposal failed",
    );
}
