import { TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import { type PluginBuild, build } from "esbuild";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { E2eProcessTrace } from "../../../utils/src/E2eProcessTrace";
import { isOrdinarilyClosedReadonlyLauncher } from "../../../utils/src/isOrdinarilyClosedReadonlyLauncher";
import { BatchWorkspace } from "../batch/BatchWorkspace";
import { nativeLintConfigCorpus } from "../batch/nativeLintConfigCorpus";
import { nativeWatchCorpus } from "../batch/nativeWatchCorpus";
import { serviceCorpus } from "../batch/serviceCorpus";
import { nativeLintConnections } from "../internal/lint/nativeLintConnections";
import { originalPositionFor } from "../internal/unplugin/internal/source-map/originalPositionFor";
import { positionOf } from "../internal/unplugin/internal/source-map/positionOf";
import { test_lint_write_commands_share_one_consumer } from "./lint/native-plugins/fix/case_lint_write_commands_share_one_consumer";
import { test_watch_topology_classifies_config_and_plugin_reload_inputs } from "./ttsc/watch/test_watch_topology_classifies_config_and_plugin_reload_inputs";

/**
 * Verifies one real esbuild graph and its actual disposal carry all source
 * rows.
 *
 * The built adapter is a public esbuild plugin. A public onDispose observer
 * awaits this same build's teardown without intercepting internal methods.
 *
 * 1. Build the shared multi-module graph once through the real adapter.
 * 2. Await the build's public disposal and interpret its actual IIFE.
 * 3. Compare the full independent matrix and retained utility controls.
 *
 * @evidence contracts/testing.md#behavioral-verification One real esbuild output must yield all661 exact native string values and authored contract/JSON neighbors with parsed-source controls retained; its public disposal must occur exactly once.
 * @evidence contracts/testing.md#independent-expectations Pre-print UTF-16 literals and authored42/retained values fix expected meaning. onDispose is the public host event rather than a predicted native process count.
 * @evidence contracts/testing.md#distinguishing-cases All quote/context/control string contrasts and parsed-source controls coexist in the same graph. Disposal is distinguished from a build that leaves its registered owner alive.
 * @evidence contracts/testing.md#execution-ownership This selected batch invokes esbuild.build exactly once. The rows are assertions on returned bytes, never separate context/rebuild calls. A separate upfront service subtree owns one public one-shot transform and one native resident. One additional Node owner runs up to three compiler-list topology lifetimes. Native lint config uses two real launcher and two compiler API calls; nativeLintConnections selects the remaining named native Go owners in one package process, retaining executable-config children, real/linked resident reuse and cache-opt-out lifetimes, and AwaitThenable original/suggested Node witnesses. Moved typed/CJS loader and format-only exports are observed in the existing config and write consumer calls; binding-import effects share the existing runtime actor, while dirty/clean formatting sidecars belong to the existing LSP actor. The shared write consumer still runs its actual fix and format commands. Those costs and native refreshes are not one execution; complete subprocess/Program totals remain unmeasured. Independent corpus failures are collected.
 * @evidence contracts/e2e.md#necessary-boundary Public esbuild plugin setup, native output delivery and onDispose must agree under the real host; captured hooks alone cannot establish that connection.
 * @evidence contracts/e2e.md#shared-execution One existing input graph, plugin artifact and one build serve every value. Compatible inputs share preparation; this test starts no per-row compiler or project.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity write:false preserves inputs and public onDispose is awaited after the actual build. Cache environment restores in finally; a failed build remains an error and does not certify successful teardown.
 * @evidence contracts/e2e.md#preserved-coverage Keeps actual esbuild adapter delivery and teardown with the common value/utility matrix. The production-used createEsbuildBuildLifecycle operation and existing source-unit ownership matrix retain repeated start, unstarted/unknown disposal, overlap, last reset and late-disposal decisions. This one installed build owns real setup/delivery/disposal connection; it does not replay the old multi-context timing or fixture compile1/2/3 receipts.
 */
export async function test_e2e_esbuild_batch(): Promise<void> {
  const workspace = await BatchWorkspace.open();
  const combinedFailures: unknown[] = [];
  try {
    nativeLintConfigCorpus(workspace);
  } catch (error) {
    combinedFailures.push(error);
  }
  await BatchWorkspace.open();
  try {
    nativeLintConnections();
  } catch (error) {
    combinedFailures.push(error);
  }
  try {
    const topologyRoot = path.join(
      workspace.root,
      "tools/native-compiler-topology",
    );
    const result = E2eProcessTrace.spawnSync(
      process.execPath,
      [
        "--import",
        pathToFileURL(
          path.join(
            TestProject.WORKSPACE_ROOT,
            "config/register-typescript-loader.mjs",
          ),
        ).href,
        path.join(topologyRoot, "worker.mjs"),
        pathToFileURL(
          path.join(
            TestProject.WORKSPACE_ROOT,
            "tests/test-e2e/src/batch/nativeCompilerTopologyCorpus.ts",
          ),
        ).href,
        topologyRoot,
      ],
      {
        cwd: topologyRoot,
        env: { ...process.env, TTSC_CACHE_DIR: workspace.cache },
        encoding: "utf8",
        windowsHide: true,
        timeout: 180000,
      },
    );
    if (!isOrdinarilyClosedReadonlyLauncher(result)) {
      BatchWorkspace.retain(
        "native compiler topology owner closure remained unresolved",
      );
      throw new Error(
        "native compiler topology owner closure remained unresolved",
        { cause: result.error },
      );
    }
    try {
      process.kill(result.pid, 0);
      BatchWorkspace.retain("native compiler topology owner PID remained live");
      throw new Error("native compiler topology owner PID remained live");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
        BatchWorkspace.retain(
          "native compiler topology owner PID departure could not be observed",
        );
        throw error;
      }
    }
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(JSON.parse(result.stdout.trim()), { ok: true });
  } catch (error) {
    combinedFailures.push(error);
  }
  await BatchWorkspace.open();
  try {
    await test_lint_write_commands_share_one_consumer({
      root: path.join(workspace.root, "tools/public-lint"),
      cache: workspace.cache,
      retain: BatchWorkspace.retain,
    });
  } catch (error) {
    combinedFailures.push(error);
  }
  await BatchWorkspace.open();
  const service = serviceCorpus(workspace).catch((error: unknown) => {
    combinedFailures.push(error);
  });
  const nativeWatch = nativeWatchCorpus(workspace).catch((error: unknown) => {
    combinedFailures.push(error);
  });
  let topologyClosed = false;
  const topology =
    test_watch_topology_classifies_config_and_plugin_reload_inputs(
      path.join(workspace.root, "tools/native-topology"),
      () => {
        topologyClosed = true;
      },
    )
      .catch((error: unknown) => {
        combinedFailures.push(error);
      })
      .finally(() => {
        if (!topologyClosed)
          BatchWorkspace.retain(
            "native topology supported close did not complete",
          );
      });
  try {
    const previous = process.env.TTSC_CACHE_DIR;
    process.env.TTSC_CACHE_DIR = workspace.cache;
    let disposals = 0;
    let resolveDisposed!: () => void;
    const disposed = new Promise<void>((resolve) => {
      resolveDisposed = resolve;
    });
    try {
      const adapter = await TestUnpluginRuntime.loadUnpluginAdapter("esbuild");
      const result = await build({
        absWorkingDir: workspace.root,
        entryPoints: ["src/bundle.ts"],
        bundle: true,
        minify: false,
        format: "iife",
        write: false,
        sourcemap: "external",
        outfile: path.join(workspace.root, "dist/esbuild-shared.js"),
        logLevel: "silent",
        plugins: [
          adapter(),
          {
            name: "observe-shared-build-disposal",
            setup(host: PluginBuild) {
              host.onDispose(() => {
                disposals++;
                resolveDisposed();
              });
            },
          },
        ],
      });
      let timer: NodeJS.Timeout | undefined;
      try {
        await Promise.race([
          disposed,
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error("esbuild disposal did not complete")),
              30_000,
            );
          }),
        ]);
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
      assert.equal(disposals, 1);
      assert.equal(result.outputFiles.length, 2);
      const output = result.outputFiles.find((file) =>
        file.path.endsWith(".js"),
      );
      const mapOutput = result.outputFiles.find((file) =>
        file.path.endsWith(".js.map"),
      );
      assert.ok(output);
      assert.ok(mapOutput);
      const code = output.text;
      BatchWorkspace.assertResult(
        BatchWorkspace.readBundle(code),
        workspace.expected,
      );
      const map = JSON.parse(mapOutput.text);
      assert.equal(map.version, 3);
      const marker = '"map-coordinate-control"';
      const generated = positionOf(code, marker);
      const original = originalPositionFor(
        map,
        generated.line,
        generated.column,
      );
      assert.ok(
        original,
        "the generated control must map to its authored source",
      );
      assert.match(original.source, /(?:^|\/)map\.ts$/);
      const authored = fs
        .readFileSync(path.join(workspace.root, "src/map.ts"), "utf8")
        .replace(/\r\n/g, "\n");
      assert.equal(
        map.sourcesContent[map.sources.indexOf(original.source)]!.replace(
          /\r\n/g,
          "\n",
        ),
        authored,
      );
      assert.deepEqual(
        { line: original.line, column: original.column },
        positionOf(authored, marker),
      );
    } finally {
      if (previous === undefined) delete process.env.TTSC_CACHE_DIR;
      else process.env.TTSC_CACHE_DIR = previous;
    }
  } catch (error) {
    combinedFailures.push(error);
  } finally {
    await service;
    await nativeWatch;
    await topology;
  }
  if (combinedFailures.length === 1) throw combinedFailures[0];
  if (combinedFailures.length > 1)
    throw new AggregateError(
      combinedFailures,
      "esbuild and public service boundaries failed",
    );
}
