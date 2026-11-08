import assert from "node:assert/strict";
import path from "node:path";

import type { BunLikeBuild } from "../../../../../packages/unplugin/src/core/bun/BunLikeBuild";
import type { BunLikePlugin } from "../../../../../packages/unplugin/src/core/bun/BunLikePlugin";
import type { BunRuntimeGlobal } from "../../../../../packages/unplugin/src/core/bun/BunRuntimeGlobal";
import { ensureRegistered } from "../../../../../packages/unplugin/src/core/bun/ensureRegistered";
import { register } from "../../../../../packages/unplugin/src/core/bun/register";
import { registrationState } from "../../../../../packages/unplugin/src/core/bun/registrationState";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a registered `filter` stays equal to itself while the loader uses
 * it.
 *
 * `register` compares a later call with the locked snapshot by deep equality,
 * and a RegExp compares its `lastIndex`. A global pattern that the loader tests
 * in place would leave the snapshot different from an identical later call
 * after an odd number of modules. An invalid filter also has to fail in the
 * call that supplied it and leave the pending options alone.
 *
 * 1. Register a global filter, capture the loader and load a selected module an
 *    odd number of times.
 * 2. Assert an identical `register` call is accepted and a different filter is
 *    rejected as locked.
 * 3. Register a pending filter and an invalid one, and assert the invalid call
 *    throws while the first options still select the next load.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   The actual register, ensureRegistered and captured loader accept an
 *   identical global-filter registration after three selected loads and reject
 *   a different filter with the restart error; an invalid filter throws TypeError
 *   at register and the earlier pending filter still selects the next load.
 * @evidence contracts/testing.md#independent-expectations
 *   Literal filters, load counts and the missing-project rejection define the
 *   expected outcomes; no locked or pending value is read from product state
 *   to compute them.
 * @evidence contracts/testing.md#distinguishing-cases
 *   An odd load count with a global pattern versus an equal call, an equal versus
 *   a different filter after the lock, and an invalid versus an accepted filter
 *   before it.
 * @evidence contracts/testing.md#execution-ownership
 *   One discoverable unit supplies a controlled Bun runtime global only during
 *   direct source operations and restores its exact descriptor in finally.
 *   The supported plugin setup and onLoad API runs over literal temporary files
 *   and a missing project file; no built entry, Bun process or native producer
 *   runs, and stable-Bun acceptance stays with test_bun_filter_runs_under_real_bun.
 */
export async function test_bun_register_filter_keeps_locked_options_stable(): Promise<void> {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "Bun");
  try {
    const root = TestProject.tmpdir("ttsc-bun-filter-register-");
    TestProject.writeFiles(root, {
      "tsconfig.json": '{"compilerOptions":{"plugins":[]},"include":["src"]}',
      "src/main.ts": "export const main: number = 1;\n",
    });
    const main = path.join(root, "src", "main.ts");

    const locked = await installLoader();
    register({ filter: /main\.ts$/g, plugins: [] });
    for (let load = 0; load < 3; ++load)
      assert.deepEqual(await locked.loader({ path: main }), {
        contents: "export const main: number = 1;\n",
        loader: "ts",
      });
    assert.doesNotThrow(() => register({ filter: /main\.ts$/g, plugins: [] }));
    assert.throws(
      () => register({ filter: /other\.ts$/g, plugins: [] }),
      /options are locked[\s\S]*Restart the Bun process/,
    );

    const pending = await installLoader();
    const probe = {
      plugins: [{ transform: "./plugin.cjs", name: "probe" }],
      project: path.join(root, "missing-tsconfig.json"),
    };
    register({ filter: /main\.ts$/, ...probe });
    assert.throws(() => register({ filter: "main.ts" as never }), TypeError);
    await assert.rejects(
      pending.loader({ path: main }),
      /tsconfig not found/,
      "an invalid register call must not replace the pending options",
    );
  } finally {
    if (descriptor === undefined) delete (globalThis as { Bun?: unknown }).Bun;
    else Object.defineProperty(globalThis, "Bun", descriptor);
  }
}

async function installLoader(): Promise<{
  loader: Parameters<BunLikeBuild["onLoad"]>[1];
}> {
  const captured: BunLikePlugin[] = [];
  const runtime: BunRuntimeGlobal = {
    plugin: (plugin) => {
      captured.push(plugin);
    },
  };
  Object.defineProperty(globalThis, "Bun", {
    configurable: true,
    writable: true,
    value: runtime,
  });
  ensureRegistered(runtime, registrationState(runtime));
  assert.equal(captured.length, 1);
  let loader: Parameters<BunLikeBuild["onLoad"]>[1] | undefined;
  await captured[0]!.setup({
    onLoad: (_options, callback) => {
      loader = callback;
    },
  });
  assert.ok(loader);
  return { loader };
}
