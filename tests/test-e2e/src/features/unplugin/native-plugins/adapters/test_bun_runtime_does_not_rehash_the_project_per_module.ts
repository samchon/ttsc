import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { captureBunLoader } from "../../../../internal/unplugin/internal/adapter-bun/captureBunLoader";

/**
 * Verifies Bun's runtime plugin keeps one immutable generation for its
 * module-loading session.
 *
 * `Bun.plugin()` exposes `onLoad` but no `onStart`. One setup invocation is one
 * process-scoped module-loading session, so the adapter must start a build
 * scope during setup rather than leave the shared cache in persistent mode,
 * where every module would re-prove the whole project.
 *
 * 1. Capture the runtime loader and load the entry module.
 * 2. Rewrite the entry module on disk.
 * 3. Load the second module and assert it is served from the same generation.
 *
 * @evidence contracts/testing.md#behavioral-verification After main is corrupted, the first delivery of secondary still returns secondary = 1 from the original generation.
 * @evidence contracts/testing.md#independent-expectations Secondary fixture literal and a main no longer accepted by the plugin distinguish immutable startup reuse from a fresh compile.
 * @evidence contracts/testing.md#distinguishing-cases First main delivery then untouched secondary after another input changes.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_bun_runtime_does_not_rehash_the_project_per_module is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-unplugin start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Captured runtime onLoad drives real native output; actual Bun module caching is outside this case.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Normal end hooks close modeled owners where invoked; failure/cancellation cleanup lacks a finally guarantee here. Runner exit bounds remaining sessions and tracked roots.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: after main is corrupted, the first delivery of secondary still returns secondary = 1 from the original generation. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_bun_runtime_does_not_rehash_the_project_per_module(): Promise<void> {
  const unpluginBun = await TestUnpluginRuntime.loadUnpluginAdapter("bun");
  const root = TestUnpluginProject.createProject({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "fixture",
        operation: "echo-file",
        path: "src/secondary.ts",
      },
    ],
  });
  const secondary = path.join(root, "src", "secondary.ts");
  fs.writeFileSync(secondary, "export const secondary = 1;\n", "utf8");
  const { loader } = await captureBunLoader(unpluginBun());

  const first = await loader({ path: TestUnpluginProject.mainFile(root) });
  assert.ok(first);

  // A persistent-validation cache would observe this unrelated input change
  // and reject the next lazy module. Runtime setup deliberately fences one
  // immutable module-loading session, so the already compiled lazy output
  // remains deliverable without a project-wide validation pass.
  fs.writeFileSync(
    TestUnpluginProject.mainFile(root),
    "export const broken = true;\n",
    "utf8",
  );
  const lazy = await loader({ path: secondary });
  assert.ok(lazy);
  assert.match(lazy.contents, /secondary = 1/);
}
