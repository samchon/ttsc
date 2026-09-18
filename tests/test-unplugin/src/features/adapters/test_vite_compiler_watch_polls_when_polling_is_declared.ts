import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createViteServeInputWatch } from "../../../../../packages/unplugin/lib/core/vite/createViteServeInputWatch.js";

/**
 * Verifies a dev server told to poll observes compiler inputs by polling
 * instead of trusting native watchers (samchon/ttsc#1395).
 *
 * On a filesystem that accepts a native watch and never reports an event, the
 * compiler-input watcher used to open its recursive observers anyway, so an
 * edit to a declaration or plugin config never invalidated its importers.
 * `server.watch.usePolling` is how a Vite user declares that filesystem, and
 * `CHOKIDAR_USEPOLLING`, which overrides it inside Vite, is honored the same
 * way.
 *
 * 1. Attach a server whose watch options declare polling, through a watch seam
 *    that records every observer and never reports an event.
 * 2. Register an input inside the project and one in a sibling package, and assert
 *    no observer opened.
 * 3. Edit the sibling input, tick the poll, and assert the importer is
 *    invalidated.
 * 4. Override the option with `CHOKIDAR_USEPOLLING=false` and assert the project
 *    observer opens again.
 */
export async function test_vite_compiler_watch_polls_when_polling_is_declared(): Promise<void> {
  const workspace = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-vite-watch-polling-"),
  );
  const root = path.join(workspace, "app");
  const sibling = path.join(workspace, "shared");
  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(sibling, { recursive: true });
  const local = path.join(root, "types.d.ts");
  const shared = path.join(sibling, "index.d.ts");
  fs.writeFileSync(local, "export declare const local: 1;\n");
  fs.writeFileSync(shared, "export declare const shared: 1;\n");
  const importer = path.join(root, "main.ts").replace(/\\/g, "/");

  const open = (usePolling: boolean) => {
    const opened: string[] = [];
    const invalidated = new Set<string>();
    const poller: { tick?: () => void } = {};
    const watch = createViteServeInputWatch({
      poll(listener) {
        poller.tick = listener;
        return { close: () => (poller.tick = undefined) };
      },
      watch(scope) {
        opened.push(path.resolve(scope));
        return { close: () => undefined };
      },
    });
    watch.attach({
      config: { root, server: { watch: { usePolling } } },
      moduleGraph: {
        getModulesByFile: (file) =>
          file === importer ? new Set([{ file }]) : undefined,
        invalidateModule: (node) =>
          invalidated.add((node as { file: string }).file),
      },
    });
    watch.replace(importer, [{ file: local }, { file: shared }]);
    return { invalidated, opened, poller, watch };
  };

  const prior = process.env.CHOKIDAR_USEPOLLING;
  delete process.env.CHOKIDAR_USEPOLLING;
  try {
    const polled = open(true);
    try {
      assert.deepEqual(
        polled.opened,
        [],
        "a server that polls opens no native observer",
      );
      assert.ok(polled.poller.tick, "every input must be on the shared poll");
      fs.writeFileSync(shared, "export declare const shared: 2;\n");
      for (let tick = 0; tick < 4 && polled.invalidated.size === 0; tick += 1) {
        polled.poller.tick?.();
      }
      assert.deepEqual(
        [...polled.invalidated],
        [importer],
        "an edit seen only by the poll must invalidate its importer",
      );
    } finally {
      await polled.watch.dispose();
    }

    process.env.CHOKIDAR_USEPOLLING = "false";
    const overridden = open(true);
    try {
      assert.ok(
        overridden.opened.includes(path.resolve(root)),
        "CHOKIDAR_USEPOLLING=false overrides the option, as it does in Vite",
      );
    } finally {
      await overridden.watch.dispose();
    }
  } finally {
    if (prior === undefined) delete process.env.CHOKIDAR_USEPOLLING;
    else process.env.CHOKIDAR_USEPOLLING = prior;
  }
}
