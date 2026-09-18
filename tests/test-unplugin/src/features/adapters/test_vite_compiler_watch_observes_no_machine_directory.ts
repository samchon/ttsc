import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createViteServeInputWatch } from "../../../../../packages/unplugin/lib/core/vite/createViteServeInputWatch.js";

/**
 * Verifies the Vite serve watcher opens no observer on the project root's
 * ancestors, while a sibling package keeps its own (samchon/ttsc#1411).
 *
 * TypeScript-Go probes `node_modules` in every ancestor of the project, so the
 * missing inputs a transform reports include `<ancestor>/node_modules/...`.
 * Rooting a recursive observer at their nearest existing directory watched the
 * user's home or `AppData` directory, and on Windows it did so inside the dev
 * server process, where Node's fs-event backend aborted it. Such an input is
 * now polled; an input in a sibling package, which is not an ancestor, still
 * gets a native scope.
 *
 * 1. Register a missing probe in an ancestor's `node_modules` and a file in a
 *    sibling package through a watch seam that records every scope root.
 * 2. Assert no scope was opened on an ancestor of the project, and the sibling
 *    package got one.
 * 3. Create the missing probe, tick the poll, and assert the importer is
 *    invalidated.
 */
export async function test_vite_compiler_watch_observes_no_machine_directory(): Promise<void> {
  const workspace = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-vite-watch-machine-"),
  );
  const root = path.join(workspace, "apps", "web");
  const sibling = path.join(workspace, "packages", "shared");
  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(sibling, { recursive: true });
  const shared = path.join(sibling, "index.d.ts");
  fs.writeFileSync(shared, "export declare const shared: 1;\n");
  const probe = path.join(
    workspace,
    "apps",
    "node_modules",
    "dep",
    "index.d.ts",
  );
  const opened: string[] = [];
  const invalidated = new Set<string>();
  let poll: (() => void) | undefined;
  const watch = createViteServeInputWatch({
    poll(listener) {
      poll = listener;
      return { close: () => (poll = undefined) };
    },
    watch(scope) {
      opened.push(path.resolve(scope));
      return { close: () => undefined };
    },
  });
  const importer = path.join(root, "main.ts").replace(/\\/g, "/");
  watch.attach({
    config: { root },
    moduleGraph: {
      getModulesByFile: (file) =>
        file === importer ? new Set([{ file }]) : undefined,
      invalidateModule: (node) =>
        invalidated.add((node as { file: string }).file),
    },
  });
  try {
    watch.replace(importer, [{ file: probe }, { file: shared }]);
    const ancestors = opened.filter(
      (scope) =>
        scope !== path.resolve(root) &&
        path.relative(scope, root) !== "" &&
        !path.relative(scope, root).startsWith(".."),
    );
    assert.deepEqual(
      ancestors,
      [],
      "no observer may open on an ancestor of the project",
    );
    assert.ok(
      opened.includes(path.resolve(sibling)),
      `a sibling package must keep a native scope; opened: ${opened.join(", ")}`,
    );

    assert.ok(poll, "the polled probe must keep the shared poll open");
    fs.mkdirSync(path.dirname(probe), { recursive: true });
    fs.writeFileSync(probe, "export {};\n");
    for (let tick = 0; tick < 4 && invalidated.size === 0; tick += 1) poll();
    assert.deepEqual(
      [...invalidated],
      [importer],
      "an ancestor probe that appears must still invalidate its importer",
    );
  } finally {
    await watch.dispose();
  }
}
