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
 * Verifies pending registration options are detached and locked at loader
 * entry, before its first asynchronous disk read settles.
 *
 * Source installation before or after explicit registration models the portable
 * option-preservation obligation. It does not load both emitted module
 * conditions, run real Bun or prove transformed native plugin output.
 *
 * 1. Install before or after explicit A, then capture the actual loader setup.
 * 2. Preserve explicit PRESERVED through later installation, or replace pending A
 *    with B and mutate the supplied B object afterward.
 * 3. Start a missing TypeScript load, allow the same original options and reject C
 *    synchronously, then require the actual pending read to reject with
 *    ENOENT.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual register/ensureRegistered/registrationState and captured plugin setup own one loader under both installation orders. Explicit PRESERVED survives later installation; in replacement rows pending A is replaced by detached B; first transformable loader entry locks B before awaiting native read. Equal B remains permitted and changed C throws the restart error while that load is pending.
 * @evidence contracts/testing.md#independent-expectations Literal PRESERVED/A/B/C/MUTATED plugin values, one registration and ENOENT define the expected transitions. Equal original B acceptance versus mutated/candidate C rejection distinguishes a detached synchronous lock without computing expected options from active or locked product state.
 * @evidence contracts/testing.md#distinguishing-cases Installation before and after explicit registration preserves one loader; a separate PRESERVED row locks explicit options without a later replacement masking installation loss. A then B is last-call-wins before load, caller mutation does not win, equal B is idempotent after synchronous entry, and C plus the mutated supplied object are rejected. Actual missing-file rejection contrasts option locking with successful native compilation, which remains E2E-owned.
 * @evidence contracts/testing.md#execution-ownership One discoverable unit supplies a controlled Bun runtime global only during direct source operations and restores its exact descriptor in finally. The supported plugin/setup/onLoad API is captured and a real absent temporary path is read; no built dual-condition import, Bun process, native producer, compiler or private state mutation runs. E2E originals and secondary-module native generation behavior remain untouched.
 */
export async function test_bun_registration_locks_detached_pending_options(): Promise<void> {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "Bun");
  try {
    for (const { preloadFirst, replacePending } of [
      { preloadFirst: true, replacePending: true },
      { preloadFirst: false, replacePending: true },
      { preloadFirst: false, replacePending: false },
    ]) {
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
      const state = registrationState(runtime);
      if (preloadFirst) ensureRegistered(runtime, state);
      register({
        projectRoot: "../workspace",
        plugins: [
          {
            transform: "./plugin.cjs",
            name: "prefix",
            prefix: replacePending ? "A:" : "PRESERVED:",
          },
        ],
      });
      if (!preloadFirst) ensureRegistered(runtime, state);
      assert.equal(captured.length, 1);
      let loader: Parameters<BunLikeBuild["onLoad"]>[1] | undefined;
      await captured[0]!.setup({
        onLoad: (_options, callback) => {
          loader = callback;
        },
      });
      assert.ok(loader);
      const supplied = {
        projectRoot: "../selected-workspace",
        plugins: [{ transform: "./plugin.cjs", name: "prefix", prefix: "B:" }],
      };
      if (replacePending) {
        register(supplied);
        supplied.plugins[0]!.prefix = "MUTATED:";
        supplied.projectRoot = "../mutated-workspace";
      }
      assert.equal(captured.length, 1);
      const missing = path.join(
        TestProject.tmpdir("ttsc-unplugin-register-pending-"),
        "missing.ts",
      );
      const pending = loader({ path: missing });
      const settled = assert.rejects(
        pending,
        (failure: unknown) =>
          failure instanceof Error &&
          (failure as NodeJS.ErrnoException).code === "ENOENT",
      );
      try {
        assert.doesNotThrow(() =>
          register({
            projectRoot: replacePending ? "../selected-workspace" : "../workspace",
            plugins: [
              {
                transform: "./plugin.cjs",
                name: "prefix",
                prefix: replacePending ? "B:" : "PRESERVED:",
              },
            ],
          }),
        );
        assert.throws(
          () => register({
            projectRoot: "../another-workspace",
            plugins: [{ transform: "./plugin.cjs", name: "prefix", prefix: replacePending ? "B:" : "PRESERVED:" }],
          }),
          /options are locked[\s\S]*Restart the Bun process/,
        );
        assert.throws(
          () =>
            register({
              projectRoot: replacePending ? "../selected-workspace" : "../workspace",
              plugins: [
                { transform: "./plugin.cjs", name: "prefix", prefix: "C:" },
              ],
            }),
          /options are locked[\s\S]*Restart the Bun process/,
        );
        if (replacePending)
          assert.throws(
            () => register(supplied),
            /options are locked[\s\S]*Restart the Bun process/,
          );
        assert.equal(captured.length, 1);
      } finally {
        await settled;
      }
    }
  } finally {
    if (descriptor === undefined) delete (globalThis as { Bun?: unknown }).Bun;
    else Object.defineProperty(globalThis, "Bun", descriptor);
  }
}
