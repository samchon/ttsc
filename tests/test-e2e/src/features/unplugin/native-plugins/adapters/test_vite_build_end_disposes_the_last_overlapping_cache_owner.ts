import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { invokeVitePluginHook } from "../../../../internal/unplugin/internal/adapter-vite-serve/invokeVitePluginHook";
import { loadViteAdapterPlugin } from "../../../../internal/unplugin/internal/adapter-vite-serve/loadViteAdapterPlugin";
import { createCacheProject } from "../../../../internal/unplugin/internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../../../internal/unplugin/internal/transform-project-cache/projectModules";

/**
 * Verifies overlapping Vite containers dispose only their own cache ownership.
 *
 * Vite constructs a replacement container before ending the old one during a
 * restart, and closes even a container that never reached `buildStart`. Neither
 * the unstarted container's nor the old container's `buildEnd` may clear the
 * replacement's generation, while the replacement's own `buildEnd` must dispose
 * it and its trackers.
 *
 * 1. Start the old container and deliver a module, then end an unstarted container
 *    and assert the generation survives a later input change.
 * 2. Start the replacement, end the old container, and assert the replacement's
 *    generation survives a later input change.
 * 3. End the replacement and assert the next delivery compiles again.
 *
 * @evidence contracts/testing.md#behavioral-verification Unstarted and old lifecycle buildEnd keep live generation at counts one and two; replacement buildEnd forces count three.
 * @evidence contracts/testing.md#independent-expectations Fixture compile log counts native executions; deliberate plugin edits would expose an incorrectly cleared build scope.
 * @evidence contracts/testing.md#distinguishing-cases Unstarted owner, overlapping replacement, old end, final end and later delivery.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_vite_build_end_disposes_the_last_overlapping_cache_owner is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-unplugin start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Built Vite lifecycle hooks drive native generations with simulated container identities; real restart scheduling is complementary.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. The finally block releases modeled lifecycle owner; tracked roots end at process exit. Captured host does not establish live-host cancellation cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: unstarted and old lifecycle buildEnd keep live generation at counts one and two; replacement buildEnd forces count three. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_vite_build_end_disposes_the_last_overlapping_cache_owner(): Promise<void> {
  const plugin = await loadViteAdapterPlugin();
  const unstartedLifecycle = {};
  const oldLifecycle = {};
  const replacementLifecycle = {};
  const project = createCacheProject({
    fileCount: 4,
    graphCandidates: 1,
    graphFanout: 1,
  });
  const modules = projectModules(project.root);
  const runCount = () =>
    fs.existsSync(project.runLog)
      ? fs.readFileSync(project.runLog, "utf8").length
      : 0;
  const deliver = async (file: string) =>
    invokeVitePluginHook(
      plugin.transform,
      { addWatchFile: () => undefined },
      fs.readFileSync(file, "utf8"),
      file,
    );
  invokeVitePluginHook(
    plugin.configResolved,
    {},
    {
      command: "serve",
      resolve: { alias: [] },
      server: { watch: null },
    },
  );
  invokeVitePluginHook(plugin.configureServer, {}, {});

  try {
    await invokeVitePluginHook(plugin.buildStart, oldLifecycle);
    assert.ok(await deliver(modules[0]!));
    assert.equal(runCount(), 1);

    // Vite closes even a container that never reached buildStart. Its buildEnd
    // must not consume the live lifecycle owned by a different container.
    await invokeVitePluginHook(plugin.buildEnd, unstartedLifecycle);
    fs.appendFileSync(
      path.join(project.root, "plugin.cjs"),
      "\n// changed after an unstarted container ended\n",
      "utf8",
    );
    assert.ok(await deliver(modules[1]!));
    assert.equal(
      runCount(),
      1,
      "an unstarted container's buildEnd must not reset the live build-scoped generation",
    );

    // Model Vite restart ordering: replacement buildStart precedes old buildEnd.
    await invokeVitePluginHook(plugin.buildStart, replacementLifecycle);
    assert.ok(await deliver(modules[2]!));
    assert.equal(runCount(), 2);
    await invokeVitePluginHook(plugin.buildEnd, oldLifecycle);

    fs.appendFileSync(
      path.join(project.root, "plugin.cjs"),
      "\n// changed after the replacement generation was captured\n",
      "utf8",
    );
    assert.ok(await deliver(modules[3]!));
    assert.equal(
      runCount(),
      2,
      "the old container's buildEnd must not reset the replacement's build-scoped generation",
    );

    await invokeVitePluginHook(plugin.buildEnd, replacementLifecycle);
    assert.ok(await deliver(modules[0]!));
    assert.equal(
      runCount(),
      3,
      "the last container's buildEnd must dispose its generation before any later transform",
    );
  } finally {
    // buildEnd is idempotent per context. End every modeled owner even when a
    // transform/assertion failed, then pair one fresh lifecycle to reset any
    // ownerless persistent generation created by the post-close diagnostic.
    await invokeVitePluginHook(plugin.buildEnd, unstartedLifecycle);
    await invokeVitePluginHook(plugin.buildEnd, oldLifecycle);
    await invokeVitePluginHook(plugin.buildEnd, replacementLifecycle);
    const cleanupLifecycle = {};
    await invokeVitePluginHook(plugin.buildStart, cleanupLifecycle);
    await invokeVitePluginHook(plugin.buildEnd, cleanupLifecycle);
  }
}
