import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/src/core/transform/cache/TtscCachedProjectTransform";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { notifyWatchInputs } from "../../../../../packages/unplugin/src/core/transform/watch/notifyWatchInputs";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/readProjectMembershipPolicy";
import { createViteServeInputWatch } from "../../../../../packages/unplugin/src/core/vite/createViteServeInputWatch";
import { createViteServeWatchHooks } from "../../../../../packages/unplugin/src/core/vite/createViteServeWatchHooks";
import { TestProject } from "../../../../utils/src/TestProject";
import { waitFor } from "../../internal/adapter-vite-serve/waitFor";

/**
 * Verifies Vite shares compiler input registration without widening module
 * invalidation.
 *
 * Two delivered modules share one declaration. Only one depends on a private
 * input.
 *
 * 1. Deliver both modules through the actual Vite hook and capture the input
 *    handoffs.
 * 2. Change the private input and require only its dependent module to reload.
 * 3. Release that module, then change the shared declaration and require the other
 *    module to reload.
 * 4. In a separate process, evict several compiler generations and verify their
 *    outputs can be collected while the oldest importer's resolver watch
 *    works.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual delivery, Vite registration and native file comparisons use fixture files and an injected notification. A GC-enabled Node actor checks eight retired generations and records the oldest importer's reload.
 * @evidence contracts/testing.md#independent-expectations Explicit graph edges identify the single private dependent, and both modules consume the authored declaration.
 * @evidence contracts/testing.md#distinguishing-cases One shared array contrasts with per-module registration. Private, shared and retired-generation resolver inputs exercise selective fanout through replacements and removal of one importer.
 * @evidence contracts/testing.md#execution-ownership Uses the observer's watch seam and closes the watcher in both processes. The runner owns each temporary root, and the Node actor exits before the unit returns.
 */
export async function test_vite_compiler_watch_groups_generation_inputs(): Promise<void> {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-vite-watch-group-"),
  );
  const config = path.join(root, "tsconfig.json");
  const first = path.join(root, "first.ts");
  const second = path.join(root, "second.ts");
  const shared = path.join(root, "shared.d.ts");
  const privateInput = path.join(root, "private.d.ts");
  for (const file of [first, second, shared, privateInput])
    fs.writeFileSync(file, "export {};\n");
  fs.writeFileSync(config, '{"include":["*.ts"]}');
  const cached: TtscCachedProjectTransform = {
    inputHashes: {},
    membershipPolicy: readProjectMembershipPolicy(config),
    projectRoot: root,
    scratchDirectory: path.join(root, "already-disposed-compiler-scratch"),
    tsconfig: config,
    result: {
      type: "success",
      typescript: { "first.ts": "export {};", "second.ts": "export {};" },
      graph: {
        edges: { "first.ts": ["private.d.ts"], "second.ts": [] },
        globals: ["shared.d.ts"],
        configs: ["tsconfig.json"],
      },
    },
  };
  let signal: ((event: string, file: string | null) => void) | undefined;
  const watch = createViteServeInputWatch({
    watch(_root, listener) {
      signal = listener;
      return { close() {} };
    },
    poll: () => ({ close() {} }),
  });
  const observations: unknown[] = [];
  const invalidated = new Set<string>();
  watch.attach({
    config: { root },
    moduleGraph: {
      getModulesByFile: (file) => new Set([{ file }]),
      invalidateModule: (node) =>
        invalidated.add(path.resolve((node as { file: string }).file)),
    },
  });
  const deliver = (file: string) => {
    const hooks = createViteServeWatchHooks(
      "serve",
      true,
      {
        replace: () =>
          assert.fail("the module must join generation observation"),
        replaceGeneration(importer, startedAt, owner, inputs, local, affected) {
          observations.push(inputs);
          assert.ok(inputs.some((input) => input.file === shared));
          assert.ok(!local.some((input) => input.file === shared));
          return watch.replaceGeneration!(
            importer,
            startedAt,
            owner,
            inputs,
            local,
            affected,
          );
        },
      },
      file,
      watch.begin(),
    );
    notifyWatchInputs(hooks, cached, file, {
      consulted: [config],
      filesystem: DEFAULT_FILESYSTEM_OPERATIONS,
      tsconfig: config,
    });
  };
  const change = async (file: string, importer: string) => {
    fs.writeFileSync(file, "export const moved: number;\n");
    assert.ok(signal);
    signal("change", path.relative(root, file));
    await waitFor(
      () => invalidated.has(importer),
      "the changed input's importer",
    );
    assert.deepEqual([...invalidated], [importer]);
    invalidated.clear();
  };
  try {
    deliver(first);
    deliver(second);
    assert.equal(observations.length, 2);
    assert.equal(observations[0], observations[1]);
    await change(privateInput, first);
    watch.forget(first);
    await change(shared, second);
  } finally {
    await watch.dispose();
  }
  const retired = spawnSync(
    process.execPath,
    [
      "--expose-gc",
      "--import",
      new URL("../../../../../config/register-unit-loader.mjs", import.meta.url)
        .href,
      fileURLToPath(
        new URL(
          "../../internal/adapter-vite-serve/retired-watch-result-actor.ts",
          import.meta.url,
        ),
      ),
      TestProject.tmpdir("ttsc-vite-retired-results-"),
    ],
    {
      encoding: "utf8",
      env: { ...process.env, NODE_OPTIONS: undefined },
      windowsHide: true,
    },
  );
  assert.ifError(retired.error);
  assert.equal(retired.status, 0, retired.stdout + retired.stderr);
}
