import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { UtilityWorkspace } from "../../../internal/UtilityWorkspace";

/**
 * Verifies the @ttsc/banner plugin: the shared native host ignores optional
 * flags it does not know.
 *
 * A newer launcher may pass flags an older native plugin has never seen. The
 * scenario loads the project's plugins through the built SDK, then runs the
 * resolved native plugin binary's `transform` command with an extra flag and
 * expects success and a transformed envelope.
 *
 * 1. Resolve the native plugin binary and plugin list with `loadProjectPlugins`.
 * 2. Run `transform` with `--future-optional-flag ignored-value`.
 * 3. Assert exit zero and a typescript envelope containing the source text.
 *
 * @evidence contracts/testing.md#behavioral-verification The resolved banner native binary must exit zero on an unknown optional flag and print a typescript envelope whose main.ts text contains the authored value.
 * @evidence contracts/testing.md#independent-expectations The forward-compatibility rule that unknown optional flags are ignored and the authored source text determine the expected status and envelope content.
 * @evidence contracts/testing.md#distinguishing-cases The unknown flag is the boundary input; the normal launcher scenarios supply the known-flag contrast.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_banner with the shared workspace; it drives the built SDK loader and a real native plugin process.
 * @evidence contracts/e2e.md#necessary-boundary The SDK plugin loader, the resolved native binary and its command protocol meet only in a real process; flag parsing in isolation cannot show the host accepts the actual argument vector.
 * @evidence contracts/e2e.md#shared-execution Reuses the shared workspace, package link and plugin cache so the plugin binary is the content-keyed cached one, built by the loader only if no earlier scenario has built it; the scenario adds one transform process.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity PATH and TTSC_CACHE_DIR are set only around the in-process loader call and restored afterwards, including on failure; the native process is joined before assertions.
 * @evidence contracts/e2e.md#preserved-coverage Retains the former exit status, envelope and source-content assertions unchanged.
 */
export function case_banner_shared_host_ignores_future_optional_flags(
  workspace: UtilityWorkspace.IWorkspace,
): void {
  const scenario = "future-flag";
  const root = UtilityWorkspace.project(workspace, scenario);
  const { loadProjectPlugins } = TestProject.REQUIRE_FROM_TEST(
    path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "ttsc",
      "lib",
      "plugin",
      "internal",
      "load",
      "loadProjectPlugins.js",
    ),
  );
  const previous = {
    PATH: process.env.PATH,
    TTSC_CACHE_DIR: process.env.TTSC_CACHE_DIR,
  };
  process.env.PATH = workspace.env.PATH;
  process.env.TTSC_CACHE_DIR = workspace.env.TTSC_CACHE_DIR;
  let loaded;
  try {
    loaded = loadProjectPlugins({
      binary: TestProject.NATIVE_BINARY,
      cwd: root,
      tsconfig: path.join(root, "tsconfig.json"),
    });
  } finally {
    process.env.PATH = previous.PATH;
    if (previous.TTSC_CACHE_DIR === undefined) delete process.env.TTSC_CACHE_DIR;
    else process.env.TTSC_CACHE_DIR = previous.TTSC_CACHE_DIR;
  }
  const loadedBinary = loaded.nativePlugins[0]?.binary;
  assert.equal(typeof loadedBinary, "string");
  const pluginsJson = JSON.stringify(
    loaded.nativePlugins.map(
      (plugin: { config: unknown; name: string; stage: string }) => ({
        config: plugin.config,
        name: plugin.name,
        stage: plugin.stage,
      }),
    ),
  );

  const result = UtilityWorkspace.run(workspace, 
    loadedBinary,
    [
      "transform",
      "--cwd",
      root,
      "--tsconfig",
      path.join(root, "tsconfig.json"),
      "--plugins-json",
      pluginsJson,
      "--future-optional-flag",
      "ignored-value",
    ],
    scenario,
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"typescript"/);
  const envelope = JSON.parse(result.stdout);
  assert.equal(typeof envelope.typescript?.["src/main.ts"], "string");
  assert.match(envelope.typescript["src/main.ts"], /future-flag/);
}
