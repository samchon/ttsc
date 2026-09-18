import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { captureBunLoader } from "../../internal/adapter-bun/captureBunLoader";

/**
 * Verifies the Bun adapter never crashes when a transform plugin reports
 * dependencies, and keeps producing correct output on both the fresh transform
 * and the subsequent cache hit.
 *
 * The shared transform calls `addWatchFile` once per plugin-reported
 * dependency. The Bun adapter used to invoke the raw transform with an empty
 * receiver (`{}`), so `this.addWatchFile` was `undefined` and any reported
 * dependency threw `TypeError: this.addWatchFile is not a function` before the
 * loader could return transformed source. Bun exposes no per-module dependency
 * channel, so the adapter must supply an explicit no-op watch context rather
 * than a missing one. The dependency list deliberately mixes a project-relative
 * entry, an absolute entry, a duplicate, and the module itself — every shape
 * that reaches the watch hook — because a single reported entry is enough to
 * trip the old crash.
 */
export async function test_bun_adapter_survives_plugin_reported_dependencies(): Promise<void> {
  const unpluginBun = await TestUnpluginRuntime.loadUnpluginAdapter("bun");
  const absolute = path.join("/abs", "types", "model.d.ts");
  const root = TestUnpluginProject.createProject({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "fixture",
        operation: "emit-dependencies",
        dependencies: [
          "src/types.d.ts",
          absolute,
          "src/types.d.ts",
          "src/main.ts",
        ],
      },
    ],
  });
  const { loader } = await captureBunLoader(unpluginBun());

  // Fresh transform: the reported dependencies reach the watch hook. The old
  // empty-receiver context threw here instead of returning source.
  const first = await loader({ path: TestUnpluginProject.mainFile(root) });
  assert.ok(first);
  TestUnpluginProject.assertTransformedToPlugin(first.contents);
  assert.equal(first.loader, "ts");

  // Cache hit: the shared transform replays the dependency notification, so the
  // no-op context must stay valid on the second load too.
  const second = await loader({ path: TestUnpluginProject.mainFile(root) });
  assert.ok(second);
  TestUnpluginProject.assertTransformedToPlugin(second.contents);
  assert.equal(second.loader, "ts");
}
