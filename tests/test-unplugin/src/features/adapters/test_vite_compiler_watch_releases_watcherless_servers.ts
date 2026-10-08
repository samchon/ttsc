import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { captureWatchInputBaseline } from "../../../../../packages/unplugin/src/core/transform/watch/captureWatchInputBaseline";
import type { ViteDevServerLike } from "../../../../../packages/unplugin/src/core/vite/ViteDevServerLike";
import { createViteServeInputWatch } from "../../../../../packages/unplugin/src/core/vite/createViteServeInputWatch";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies watcherless servers acquire no compiler notification resources and
 * watching replacements retain compile-window and recovery observation.
 *
 * A Vitest run disables server watching with null. Its deliveries have no
 * compiler-input registration channel, so an attached observer has no owner. A
 * later watching server must still open before its first compilation.
 *
 * 1. Attach watcherless and watching servers, observing actual watch/poll calls.
 * 2. Change an input between begin and replace, then disable observation and
 *    require old events and registrations to remain detached.
 * 3. Re-enable at another root, exercise native failure and polling recovery, and
 *    dispose before registering an overlapping replacement.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   Calls createViteServeInputWatch through its lifecycle and registration API.
 *   Exact open/close counts prove null acquires nothing and releases prior
 *   resources; graph invalidation proves compile-window edits and failure
 *   recovery remain observable, while retired callbacks cannot affect a new server.
 * @evidence contracts/testing.md#independent-expectations
 *   Vite's null watch declaration removes the notification channel. Literal
 *   zero/one resource counts and changed versus unchanged input verdicts follow
 *   that contract, independently of observer bookkeeping.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Contrasts null with absent/default and explicit watch options, transitions
 *   across roots and polling, an edit during compilation, failed replacement,
 *   native watch failure, repeated disposal and post-disposal registration.
 * @evidence contracts/testing.md#execution-ownership
 *   The test-unplugin runner discovers this direct source unit. Native watch,
 *   polling and case capabilities are injected; real temporary files supply
 *   input state. No native producer, Vite host or installed artifact executes.
 */
export async function test_vite_compiler_watch_releases_watcherless_servers(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-vite-watcherless-lifetime-"),
  );
  const otherRoot = path.join(root, "replacement");
  fs.mkdirSync(otherRoot);
  const file = path.join(root, "input.txt");
  fs.writeFileSync(file, "before");
  const importer = path.join(root, "owner.ts").replace(/\\/g, "/");
  const invalidated: string[] = [];
  const handles: {
    root: string;
    emit(event: string, file: string | null): void;
    fail(): void;
    closes: number;
  }[] = [];
  let tick: (() => void) | undefined;
  let pollOpens = 0;
  let pollCloses = 0;
  const watch = createViteServeInputWatch({
    caseSensitive: () => true,
    poll(listener) {
      assert.equal(tick, undefined, "only one fallback scheduler is owned");
      pollOpens += 1;
      tick = listener;
      return {
        close() {
          tick = undefined;
          pollCloses += 1;
        },
      };
    },
    watch(scope, emit, fail) {
      const handle = { root: scope, emit, fail, closes: 0 };
      handles.push(handle);
      return {
        close() {
          handle.closes += 1;
        },
      };
    },
  });
  const server = (
    watchOption?: { usePolling?: boolean } | null,
    serverRoot = root,
  ): ViteDevServerLike => ({
    config: { root: serverRoot, server: { watch: watchOption } },
    moduleGraph: {
      getModulesByFile: (owner) => new Set([{ file: owner }]),
      invalidateModule: (node) => {
        invalidated.push((node as { file: string }).file);
      },
    },
  });
  const settled = async (): Promise<string[]> => {
    await new Promise((resolve) => setTimeout(resolve, 30));
    return invalidated.splice(0);
  };
  try {
    watch.attach(server(null));
    watch.replace(importer, [{ file }]);
    assert.equal(
      handles.length,
      0,
      "watcherless attachment and delivery own no native observer",
    );
    assert.equal(pollOpens, 0, "watcherless delivery owns no fallback work");

    watch.attach(server());
    assert.equal(handles.length, 1, "watching opens before compilation begins");
    const initial = handles[0];
    assert.ok(initial);
    const startedAt = watch.begin();
    const baseline = captureWatchInputBaseline(file);
    assert.ok(baseline);
    fs.writeFileSync(file, "during compilation");
    initial.emit("change", file);
    watch.replace(
      importer,
      [
        {
          file,
          evidence: {
            identity: baseline.identity,
            missing: false,
            state: { codec: "host", hash: baseline.hostHash },
          },
        },
      ],
      false,
      startedAt,
    );
    assert.deepEqual(
      await settled(),
      [importer],
      "a compile-window edit cannot be acknowledged by stale input evidence",
    );

    watch.replace(importer, [{ file }]);
    watch.attach(server(null));
    assert.equal(
      initial.closes,
      1,
      "disabling notifications retires the existing scope",
    );
    watch.replace(importer, [{ file }], true);
    fs.writeFileSync(file, "disabled");
    initial.emit("change", file);
    assert.deepEqual(
      await settled(),
      [],
      "retired events and watcherless registrations have no graph effect",
    );
    assert.equal(handles.length, 1);

    watch.attach(server({}, otherRoot));
    const nextFile = path.join(otherRoot, "input.txt");
    fs.writeFileSync(nextFile, "recovered");
    watch.replace(importer, [{ file: nextFile }]);
    assert.equal(handles.length, 2, "a replacement observes only its new root");
    const replacement = handles[1];
    assert.ok(replacement);
    assert.equal(replacement.root, otherRoot);
    replacement.fail();
    assert.equal(
      replacement.closes,
      1,
      "native failure relinquishes the scope",
    );
    assert.ok(tick, "failed coverage falls back to polling");
    watch.replace(importer, [], true);
    fs.writeFileSync(nextFile, "repair after failure");
    tick();
    assert.deepEqual(
      await settled(),
      [importer],
      "failed delivery retains spellings needed for recovery",
    );

    watch.attach(server(null, otherRoot));
    assert.equal(
      tick,
      undefined,
      "watcherless replacement releases fallback scheduling",
    );
    assert.equal(pollCloses, pollOpens);
    watch.attach(server({ usePolling: true }, otherRoot));
    watch.replace(importer, [{ file: nextFile }]);
    assert.ok(tick, "declared polling reacquires actual input observation");
    assert.equal(
      handles.length,
      2,
      "declared polling acquires no native scope",
    );
    await watch.dispose();
    assert.equal(tick, undefined);
    await watch.dispose();
    assert.equal(
      pollCloses,
      pollOpens,
      "repeated disposal closes no detached scheduler twice",
    );

    // An overlapping container can deliver after its predecessor disposes.
    watch.replace(importer, [{ file: nextFile }]);
    assert.ok(
      tick,
      "retained watching association supports replacement registration",
    );
    watch.forget(importer);
    assert.equal(
      tick,
      undefined,
      "the final input owner releases fallback work",
    );
  } finally {
    await watch.dispose();
    fs.rmSync(root, { recursive: true, force: true });
  }
  assert.equal(pollCloses, pollOpens);
  assert.deepEqual(
    handles.map((handle) => handle.closes),
    [1, 1],
  );
}
